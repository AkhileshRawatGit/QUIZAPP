"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
    submissionQueue,
    getQuizAnswerKey,
    invalidateQuizCache,
    triggerDebouncedRevalidation,
} from "@/lib/submissionQueue";

// ─────────────────────────────────────────────
// QUIZ QUERIES
// ─────────────────────────────────────────────

export async function getQuizzes() {
    try {
        return await prisma.quiz.findMany({
            where: { isActive: true },
            include: {
                _count: { select: { questions: true } }
            },
            orderBy: { createdAt: "desc" }
        });
    } catch (error) {
        console.error("GET_QUIZZES_ERROR:", error);
        return [];
    }
}

export async function getAllQuizzes() {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

        return await prisma.quiz.findMany({
            include: {
                _count: {
                    select: { questions: true, results: true, accesses: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });
    } catch (error) {
        console.error("GET_ALL_QUIZZES_ERROR:", error);
        return [];
    }
}

/**
 * Check if current user has already submitted this quiz.
 * Returns the result id if submitted, null otherwise.
 */
export async function checkUserSubmission(quizId: string): Promise<string | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;

    const result = await prisma.result.findUnique({
        where: {
            userId_quizId: { userId: session.user.id, quizId }
        },
        select: { id: true }
    });
    return result?.id ?? null;
}

export async function getQuizById(id: string) {
    const session = await getServerSession(authOptions);
    const isAdmin = session?.user?.role === "ADMIN";

    return await prisma.quiz.findUnique({
        where: { id },
        include: {
            questions: {
                orderBy: { orderIndex: "asc" },
                include: {
                    options: isAdmin ? {
                        orderBy: { orderIndex: "asc" }
                    } : {
                        select: { id: true, text: true, orderIndex: true },
                        orderBy: { orderIndex: "asc" }
                    }
                }
            }
        }
    });
}

// ─────────────────────────────────────────────
// ACCESS CONTROL
// ─────────────────────────────────────────────

/**
 * Called when a participant opens a quiz page.
 * Creates an access request if none exists, then returns current access status.
 */
export async function requestAndCheckAccess(quizId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Authentication required");

    const access = await prisma.quizAccess.upsert({
        where: {
            userId_quizId: { userId: session.user.id, quizId }
        },
        create: {
            userId: session.user.id,
            quizId,
            isGranted: false,
        },
        update: {}, // Don't change anything if already exists
    });

    return access;
}

/**
 * Lightweight poll: check if the current user's access has been granted.
 */
export async function checkMyAccess(quizId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;

    return await prisma.quizAccess.findUnique({
        where: {
            userId_quizId: { userId: session.user.id, quizId }
        }
    });
}

/**
 * Admin: Get all users with their access + result status for a quiz.
 */
export async function getAllUsersWithAccessStatus(quizId: string) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

    return await prisma.user.findMany({
        where: { role: "USER" },
        include: {
            quizAccesses: {
                where: { quizId },
            },
            results: {
                where: { quizId },
                select: {
                    id: true,
                    score: true,
                    total: true,
                    percentage: true,
                    status: true,
                    timeTaken: true,
                    createdAt: true,
                },
            },
        },
        orderBy: { createdAt: "asc" },
    });
}

/**
 * Admin: Grant access to a specific user for a quiz.
 */
export async function grantAccess(userId: string, quizId: string) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

    await prisma.quizAccess.upsert({
        where: { userId_quizId: { userId, quizId } },
        create: { userId, quizId, isGranted: true, grantedAt: new Date() },
        update: { isGranted: true, grantedAt: new Date() },
    });

    revalidatePath("/admin/access");
    return { success: true };
}

/**
 * Admin: Revoke access from a specific user.
 */
export async function revokeAccess(userId: string, quizId: string) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

    await prisma.quizAccess.upsert({
        where: { userId_quizId: { userId, quizId } },
        create: { userId, quizId, isGranted: false },
        update: { isGranted: false, grantedAt: null },
    });

    revalidatePath("/admin/access");
    return { success: true };
}

/**
 * Admin: Grant access to all users who have already requested (pending).
 */
export async function grantAllPendingAccess(quizId: string) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

    await prisma.quizAccess.updateMany({
        where: { quizId, isGranted: false },
        data: { isGranted: true, grantedAt: new Date() },
    });

    revalidatePath("/admin/access");
    return { success: true };
}

/**
 * Admin: Grant access to ALL registered users for a quiz (pre-emptive).
 */
export async function grantAllUsersAccess(quizId: string) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

    const users = await prisma.user.findMany({ where: { role: "USER" } });

    await Promise.all(
        users.map((user) =>
            prisma.quizAccess.upsert({
                where: { userId_quizId: { userId: user.id, quizId } },
                create: { userId: user.id, quizId, isGranted: true, grantedAt: new Date() },
                update: { isGranted: true, grantedAt: new Date() },
            })
        )
    );

    revalidatePath("/admin/access");
    return { success: true };
}

// ─────────────────────────────────────────────
// QUIZ SUBMISSION
// ─────────────────────────────────────────────

export async function submitQuiz(
    quizId: string,
    answers: Record<string, string>,
    timeTaken?: number
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Authentication required to submit quiz");

    const userId = session.user.id;

    // Enqueue in concurrency worker queue to prevent DB pool starvation
    return await submissionQueue.enqueue(async () => {
        // 1. Check if already submitted (idempotent)
        const existingResult = await prisma.result.findUnique({
            where: { userId_quizId: { userId, quizId } },
        });
        if (existingResult) return existingResult;

        // 2. Fetch cached answer key (superfast in-memory lookup, zero redundant DB payload)
        const key = await getQuizAnswerKey(quizId);

        let score = 0;
        const total = key.totalQuestions;

        for (const [questionId, correctOptionId] of key.correctAnswers.entries()) {
            const selectedOptionId = answers[questionId];
            if (selectedOptionId && selectedOptionId === correctOptionId) {
                score++;
            }
        }

        const percentage = total > 0 ? (score / total) * 100 : 0;
        const status = percentage >= 60 ? "PASS" : "FAIL";

        // 3. Atomically upsert result to prevent duplicate insert race conditions
        const result = await prisma.result.upsert({
            where: { userId_quizId: { userId, quizId } },
            update: {}, // Keep existing if another worker finished first
            create: {
                userId,
                quizId,
                score,
                total,
                percentage,
                status,
                timeTaken: typeof timeTaken === "number" ? timeTaken : null,
            },
        });

        triggerDebouncedRevalidation();
        return result;
    });
}

// ─────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────

export async function getUserResults() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return [];

        return await prisma.result.findMany({
            where: { userId: session.user.id },
            include: {
                quiz: { select: { title: true, category: true } }
            },
            orderBy: { createdAt: "desc" }
        });
    } catch (error) {
        console.error("GET_USER_RESULTS_ERROR:", error);
        return [];
    }
}

export async function getAllResults() {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

        return await prisma.result.findMany({
            include: {
                user: { select: { name: true, email: true, program: true } },
                quiz: { select: { title: true, category: true } }
            },
            orderBy: [
                { score: "desc" },
                { timeTaken: "asc" },
                { createdAt: "asc" },
            ]
        });
    } catch (error) {
        console.error("GET_ALL_RESULTS_ERROR:", error);
        return [];
    }
}

// ─────────────────────────────────────────────
// ADMIN: CRUD
// ─────────────────────────────────────────────

export async function createQuiz(data: {
    title: string;
    description: string;
    category: string;
    difficulty: string;
    timeLimit?: number;
    questions: {
        text: string;
        code?: string | null;
        options: { text: string; isCorrect: boolean }[];
    }[];
}) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

    if (!data.title || data.questions.length === 0) {
        throw new Error("Title and at least one question are required");
    }

    const quiz = await prisma.quiz.create({
        data: {
            title: data.title,
            description: data.description || null,
            category: data.category,
            difficulty: data.difficulty,
            timeLimit: data.timeLimit ?? 2700,
            isActive: true,   // visible on dashboard immediately
            isLocked: true,   // locked until admin unlocks
            questions: {
                create: data.questions.map((q, qIdx) => ({
                    text: q.text,
                    code: q.code || null,
                    orderIndex: qIdx,
                    options: {
                        create: q.options.map((o, oIdx) => ({
                            text: o.text,
                            isCorrect: o.isCorrect,
                            orderIndex: oIdx,
                        })),
                    },
                })),
            },
        },
    });

    revalidatePath("/dashboard");
    revalidatePath("/admin/quiz");
    return quiz;
}

export async function deleteQuiz(quizId: string) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

    invalidateQuizCache(quizId);
    await prisma.quiz.delete({ where: { id: quizId } });
    revalidatePath("/dashboard");
    revalidatePath("/admin/quiz");
    return { success: true };
}

export async function updateQuiz(
    quizId: string,
    data: {
        title: string;
        description: string;
        category: string;
        difficulty: string;
        timeLimit?: number;
        questions: {
            id?: string;
            text: string;
            code?: string | null;
            options: { id?: string; text: string; isCorrect: boolean }[];
        }[];
    }
) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

    if (!data.title || data.questions.length === 0) {
        throw new Error("Title and at least one question are required");
    }

    const existingQuiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: { questions: { include: { options: true } } }
    });

    if (!existingQuiz) throw new Error("Quiz not found");

    const existingQuestionIds = new Set(existingQuiz.questions.map((q) => q.id));
    const updatedQuestionIds = new Set(
        data.questions.filter((q) => q.id).map((q) => q.id as string)
    );

    // Delete removed questions
    const questionsToDelete = existingQuiz.questions
        .filter((q) => !updatedQuestionIds.has(q.id))
        .map((q) => q.id);

    if (questionsToDelete.length > 0) {
        await prisma.question.deleteMany({ where: { id: { in: questionsToDelete } } });
    }

    // Update or create questions
    for (let qIdx = 0; qIdx < data.questions.length; qIdx++) {
        const questionData = data.questions[qIdx];

        if (questionData.id && existingQuestionIds.has(questionData.id)) {
            const existingQuestion = existingQuiz.questions.find(
                (q) => q.id === questionData.id
            );

            await prisma.question.update({
                where: { id: questionData.id },
                data: { text: questionData.text, code: questionData.code || null, orderIndex: qIdx }
            });

            const existingOptionIds = new Set(existingQuestion?.options.map((o) => o.id) || []);
            const updatedOptionIds = new Set(
                questionData.options.filter((o) => o.id).map((o) => o.id as string)
            );

            // Delete removed options
            const optionsToDelete = [...existingOptionIds].filter(
                (id) => !updatedOptionIds.has(id)
            );
            if (optionsToDelete.length > 0) {
                await prisma.option.deleteMany({ where: { id: { in: optionsToDelete } } });
            }

            // Update or create options
            for (let oIdx = 0; oIdx < questionData.options.length; oIdx++) {
                const optionData = questionData.options[oIdx];
                if (optionData.id && existingOptionIds.has(optionData.id)) {
                    await prisma.option.update({
                        where: { id: optionData.id },
                        data: { text: optionData.text, isCorrect: optionData.isCorrect, orderIndex: oIdx }
                    });
                } else {
                    await prisma.option.create({
                        data: {
                            questionId: questionData.id,
                            text: optionData.text,
                            isCorrect: optionData.isCorrect,
                            orderIndex: oIdx,
                        }
                    });
                }
            }
        } else {
            // Create new question
            await prisma.question.create({
                data: {
                    quizId,
                    text: questionData.text,
                    code: questionData.code || null,
                    orderIndex: qIdx,
                    options: {
                        create: questionData.options.map((o, oIdx) => ({
                            text: o.text,
                            isCorrect: o.isCorrect,
                            orderIndex: oIdx,
                        })),
                    },
                }
            });
        }
    }

    await prisma.quiz.update({
        where: { id: quizId },
        data: {
            title: data.title,
            description: data.description || null,
            category: data.category,
            difficulty: data.difficulty,
            timeLimit: data.timeLimit ?? 2700,
        }
    });

    invalidateQuizCache(quizId);
    revalidatePath("/dashboard");
    revalidatePath(`/quiz/${quizId}`);
    revalidatePath("/admin/quiz");
    return { success: true };
}

export async function toggleQuizStatus(quizId: string, isActive: boolean) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

    await prisma.quiz.update({
        where: { id: quizId },
        data: { isActive },
    });

    revalidatePath("/dashboard");
    revalidatePath("/admin/quiz");
    return { success: true };
}

/**
 * Admin: Lock or unlock a quiz globally.
 * When unlocked → all participants on the locked screen auto-see the instructions.
 */
export async function toggleQuizLock(quizId: string, isLocked: boolean) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

    await prisma.quiz.update({
        where: { id: quizId },
        data: { isLocked },
    });

    revalidatePath("/admin/quiz");
    revalidatePath(`/quiz/${quizId}`);
    return { success: true };
}

/**
 * Lightweight poll: participant checks if quiz is still locked.
 * Called every 3 seconds from the locked waiting screen.
 */
export async function checkQuizLockStatus(quizId: string): Promise<boolean> {
    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        select: { isLocked: true },
    });
    return quiz?.isLocked ?? true;
}
