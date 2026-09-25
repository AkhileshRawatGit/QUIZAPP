import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface QuizAnswerKey {
    totalQuestions: number;
    isActive: boolean;
    // Map questionId -> correctOptionId
    correctAnswers: Map<string, string>;
    cachedAt: number;
}

// In-memory cache for quiz answer keys (TTL: 5 minutes)
const quizKeyCache = new Map<string, QuizAnswerKey>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getQuizAnswerKey(quizId: string): Promise<QuizAnswerKey> {
    const cached = quizKeyCache.get(quizId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached;
    }

    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        select: {
            id: true,
            isActive: true,
            questions: {
                orderBy: { orderIndex: "asc" },
                select: {
                    id: true,
                    options: {
                        where: { isCorrect: true },
                        select: { id: true },
                    },
                },
            },
        },
    });

    if (!quiz) throw new Error("Quiz not found");
    if (!quiz.isActive) throw new Error("This quiz is currently disabled");
    if (quiz.questions.length === 0) throw new Error("This quiz has no questions");

    const answerKey: QuizAnswerKey = {
        totalQuestions: quiz.questions.length,
        isActive: quiz.isActive,
        correctAnswers: new Map(),
        cachedAt: Date.now(),
    };

    for (const q of quiz.questions) {
        if (q.options.length > 0) {
            answerKey.correctAnswers.set(q.id, q.options[0].id);
        }
    }

    quizKeyCache.set(quizId, answerKey);
    return answerKey;
}

export function invalidateQuizCache(quizId: string) {
    quizKeyCache.delete(quizId);
}

// ─────────────────────────────────────────────
// CONCURRENCY WORKER QUEUE
// Ensures at most `concurrency` (15) database writes happen in parallel,
// preventing Supabase / PostgreSQL connection pool exhaustion during bursts of 200+ students.
// ─────────────────────────────────────────────

type Task<T> = () => Promise<T>;

interface QueueItem<T> {
    task: Task<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
}

class SubmissionQueue {
    private concurrency: number;
    private running: number = 0;
    private queue: QueueItem<any>[] = [];

    constructor(concurrency = 15) {
        this.concurrency = concurrency;
    }

    public enqueue<T>(task: Task<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.processNext();
        });
    }

    public getPendingCount(): number {
        return this.queue.length;
    }

    public getActiveCount(): number {
        return this.running;
    }

    private processNext() {
        while (this.running < this.concurrency && this.queue.length > 0) {
            const item = this.queue.shift();
            if (!item) break;

            this.running++;
            item.task()
                .then(item.resolve)
                .catch(item.reject)
                .finally(() => {
                    this.running--;
                    this.processNext();
                });
        }
    }
}

// Global singleton queue across server action invocations
const globalForQueue = global as unknown as { submissionQueue: SubmissionQueue };
export const submissionQueue = globalForQueue.submissionQueue || new SubmissionQueue(15);
if (process.env.NODE_ENV !== "production") globalForQueue.submissionQueue = submissionQueue;

// Debounced revalidation to avoid triggering 200 revalidations in 2 seconds
let revalidateTimer: NodeJS.Timeout | null = null;
export function triggerDebouncedRevalidation() {
    if (revalidateTimer) return;
    revalidateTimer = setTimeout(() => {
        try {
            revalidatePath("/dashboard");
            revalidatePath("/admin/access");
            revalidatePath("/admin/leaderboard");
        } catch (e) {
            // ignore during background contexts
        } finally {
            revalidateTimer = null;
        }
    }, 1500);
}
