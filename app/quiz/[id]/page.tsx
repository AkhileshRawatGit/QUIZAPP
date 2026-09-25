"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import {
    getQuizById,
    submitQuiz,
    checkQuizLockStatus,
    checkUserSubmission,
} from "@/actions/quiz";
import { useRouter } from "next/navigation";
import {
    Loader2, ArrowLeft, ArrowRight, CheckCircle2, Timer,
    Zap, Lock, Clock, RefreshCw, AlertTriangle, ShieldCheck, WifiOff,
    Maximize, Minimize
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "loading" | "locked" | "already_submitted" | "instructions" | "quiz" | "submitted";

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [quiz, setQuiz] = useState<any>(null);
    const [phase, setPhase] = useState<Phase>("loading");
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState(2700);
    const [waitSecs, setWaitSecs] = useState(0);
    const [countdown, setCountdown] = useState(10);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<{
        active: boolean;
        step: "encrypting" | "transmitting" | "success" | "error";
        attempt: number;
        maxAttempts: number;
        errorMsg?: string;
    }>({
        active: false,
        step: "encrypting",
        attempt: 1,
        maxAttempts: 3,
    });

    const hasSubmittedRef = useRef(false);
    const answersRef = useRef<Record<string, string>>({});
    const timeLeftRef = useRef(2700);
    const router = useRouter();

    // Listen to browser fullscreen change
    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFsChange);
        return () => document.removeEventListener("fullscreenchange", handleFsChange);
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                } else if ((document.documentElement as any).webkitRequestFullscreen) {
                    await (document.documentElement as any).webkitRequestFullscreen();
                }
                setIsFullscreen(true);
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                }
                setIsFullscreen(false);
            }
        } catch (err) {
            console.warn("Fullscreen toggle failed:", err);
        }
    };

    const handleStartQuiz = async () => {
        try {
            if (!document.fullscreenElement) {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                } else if ((document.documentElement as any).webkitRequestFullscreen) {
                    await (document.documentElement as any).webkitRequestFullscreen();
                }
            }
        } catch (err) {
            console.warn("Fullscreen request not granted:", err);
        }
        setPhase("quiz");
    };

    // Keep answers and timeLeft ref in sync
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    useEffect(() => {
        timeLeftRef.current = timeLeft;
    }, [timeLeft]);

    // ── Load quiz + check already submitted + check lock + restore localStorage ──
    useEffect(() => {
        async function init() {
            try {
                const [quizData, alreadySubmitted] = await Promise.all([
                    getQuizById(id),
                    checkUserSubmission(id),
                ]);

                if (!quizData) { router.push("/dashboard"); return; }

                setQuiz(quizData);
                const limit = (quizData as any).timeLimit ?? 2700;
                setTimeLeft(limit);
                timeLeftRef.current = limit;

                // Restore saved answers from browser localStorage if available
                try {
                    const saved = localStorage.getItem(`acm_quiz_answers_${id}`);
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (parsed && typeof parsed === "object") {
                            setAnswers(parsed);
                            answersRef.current = parsed;
                        }
                    }
                } catch {
                    // ignore localStorage issues
                }

                // Already submitted → redirect to dashboard
                if (alreadySubmitted) {
                    try { localStorage.removeItem(`acm_quiz_answers_${id}`); } catch {}
                    setPhase("already_submitted");
                    return;
                }

                // Check lock status
                if ((quizData as any).isLocked) {
                    setPhase("locked");
                } else {
                    setPhase("instructions");
                }
            } catch {
                router.push("/dashboard");
            }
        }
        init();
    }, [id, router]);

    // ── Already submitted: redirect after 3s ──
    useEffect(() => {
        if (phase !== "already_submitted") return;
        const t = setTimeout(() => router.push("/dashboard"), 3000);
        return () => clearTimeout(t);
    }, [phase, router]);

    // ── Submitted: 10s countdown to Home page ──
    useEffect(() => {
        if (phase !== "submitted") return;
        setCountdown(10);
        const timer = setInterval(() => {
            setCountdown((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    // Clean side-effect navigation when countdown reaches 0
    useEffect(() => {
        if (phase === "submitted" && countdown === 0) {
            router.push("/");
        }
    }, [countdown, phase, router]);

    // ── Poll lock status every 3s while locked ──
    const pollLock = useCallback(async () => {
        try {
            const locked = await checkQuizLockStatus(id);
            if (!locked) setPhase("instructions");
        } catch { /* ignore */ }
    }, [id]);

    useEffect(() => {
        if (phase !== "locked") return;
        const poll = setInterval(pollLock, 3000);
        const counter = setInterval(() => setWaitSecs((s) => s + 1), 1000);
        return () => { clearInterval(poll); clearInterval(counter); };
    }, [phase, pollLock]);

    const executeSubmit = useCallback(async () => {
        if (hasSubmittedRef.current || !quiz) return;
        hasSubmittedRef.current = true;
        setSubmitting(true);

        const currentAnswers = answersRef.current;
        const remaining = timeLeftRef.current;
        const totalLimit = (quiz?.timeLimit ?? 2700);
        const timeTaken = Math.max(0, totalLimit - remaining);

        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            setSubmitStatus({
                active: true,
                step: attempt === 1 ? "encrypting" : "transmitting",
                attempt,
                maxAttempts: maxRetries,
            });

            try {
                await submitQuiz(quiz.id, currentAnswers, timeTaken);
                setSubmitStatus({
                    active: true,
                    step: "success",
                    attempt,
                    maxAttempts: maxRetries,
                });
                try {
                    localStorage.removeItem(`acm_quiz_answers_${id}`);
                } catch {}
                if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                }
                setTimeout(() => {
                    setPhase("submitted");
                }, 800);
                return;
            } catch (err: any) {
                const isAlreadySubmitted =
                    err?.message?.includes("already submitted") ||
                    err?.message?.includes("Unique constraint");

                if (isAlreadySubmitted) {
                    try { localStorage.removeItem(`acm_quiz_answers_${id}`); } catch {}
                    if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                    }
                    setPhase("submitted");
                    return;
                }

                console.warn(`Submission attempt ${attempt}/${maxRetries} failed:`, err);

                if (attempt < maxRetries) {
                    // Jittered backoff: wait 800ms * attempt + random 100-400ms to distribute concurrent retries
                    const delay = 800 * attempt + Math.floor(Math.random() * 300);
                    await new Promise((r) => setTimeout(r, delay));
                } else {
                    hasSubmittedRef.current = false;
                    setSubmitting(false);
                    setSubmitStatus({
                        active: true,
                        step: "error",
                        attempt,
                        maxAttempts: maxRetries,
                        errorMsg: err?.message || "Server or network busy during heavy submission load. Your answers are safely saved in this browser. Please click Retry.",
                    });
                }
            }
        }
    }, [quiz, id, router]);

    // ── Quiz countdown timer ──
    useEffect(() => {
        if (phase !== "quiz") return;
        if (timeLeft <= 0) {
            executeSubmit();
            return;
        }
        const t = setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000);
        return () => clearInterval(t);
    }, [timeLeft, phase, executeSubmit]);

    const fmt = (s: number) =>
        `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    const handleOptionSelect = (optId: string) => {
        const questionId = quiz.questions[currentQuestion].id;
        const updated = { ...answers, [questionId]: optId };
        setAnswers(updated);
        answersRef.current = updated;
        try {
            localStorage.setItem(`acm_quiz_answers_${id}`, JSON.stringify(updated));
        } catch {}
    };

    const handleSubmit = () => {
        executeSubmit();
    };

    // ─── LOADING ────────────────────────────────────────────────────
    if (phase === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="fixed inset-0 grid-bg opacity-10 pointer-events-none" />
                <div className="text-center space-y-6">
                    <div className="relative w-20 h-20 mx-auto">
                        <div className="w-20 h-20 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
                        <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary animate-pulse" />
                    </div>
                    <p className="text-primary font-black text-sm tracking-[0.4em] uppercase">Connecting...</p>
                </div>
            </div>
        );
    }

    // ─── ALREADY SUBMITTED ────────────────────────────────────────────
    if (phase === "already_submitted") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-6">
                <div className="fixed inset-0 grid-bg opacity-10 pointer-events-none" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full glass p-12 rounded-[2.5rem] border border-yellow-500/30 text-center space-y-6"
                >
                    <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto border border-yellow-500/20">
                        <AlertTriangle className="w-9 h-9 text-yellow-400" />
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-3xl font-bold tracking-tighter uppercase">Already Submitted</h1>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            You have already attempted this quiz.<br />
                            Only one attempt is allowed. Redirecting to dashboard...
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600 uppercase tracking-widest">
                        <Loader2 className="w-3 h-3 animate-spin" /> Redirecting in 3s
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── 🔒 QUIZ LOCKED ─────────────────────────────────────────────
    if (phase === "locked") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-6">
                <div className="fixed inset-0 grid-bg opacity-10 pointer-events-none" />
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/10 blur-[120px] pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="max-w-lg w-full glass p-12 rounded-[2.5rem] border border-white/10 text-center space-y-10 relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-secondary/60 to-transparent animate-scan" />

                    {/* Lock icon */}
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-32 h-32 rounded-full border border-secondary/20 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="absolute w-24 h-24 rounded-full border border-secondary/30 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
                        <div className="relative w-24 h-24 rounded-full bg-secondary/10 border-2 border-secondary/40 flex items-center justify-center shadow-[0_0_40px_rgba(112,0,255,0.3)]">
                            <Lock className="w-10 h-10 text-secondary" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[11px] font-black text-secondary uppercase tracking-[0.6em]">Access Restricted</p>
                        <h1 className="text-4xl font-bold tracking-tighter uppercase leading-none">Quiz is Locked</h1>
                        <p className="text-gray-400 text-sm leading-relaxed pt-1">
                            <span className="text-white font-semibold">{quiz?.title}</span> has not started yet.
                            <br />
                            The admin will unlock it shortly. Your screen will
                            update automatically — <span className="text-primary">no refresh needed.</span>
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass rounded-2xl p-5 border border-white/5 space-y-1">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Waiting</p>
                            <p className="text-2xl font-mono font-bold text-white">{fmt(waitSecs)}</p>
                        </div>
                        <div className="glass rounded-2xl p-5 border border-white/5 space-y-1">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Status</p>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_6px_#7000ff]" />
                                <p className="text-sm font-black text-secondary uppercase tracking-wider">Locked</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-[11px] text-gray-600 uppercase tracking-widest">
                        <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: "3s" }} />
                        Checking every 3 seconds...
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── 🚀 MISSION SUBMISSION (COMPLETED) ───────────────────────────
    if (phase === "submitted") {
        const totalAnswered = Object.keys(answers).length;
        const totalQuestions = quiz?.questions?.length || 0;

        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-start md:justify-center px-4 sm:px-6 pt-32 md:pt-36 pb-16 relative overflow-y-auto">
                <div className="fixed inset-0 grid-bg opacity-10 pointer-events-none" />
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="max-w-md w-full glass p-6 sm:p-8 rounded-3xl border border-primary/30 text-center space-y-5 relative overflow-hidden shadow-[0_0_50px_rgba(0,242,255,0.12)] my-auto z-10"
                >
                    {/* Glowing Top Scanline */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />

                    {/* Animated Success Badge Icon */}
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-24 h-24 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: "2.5s" }} />
                        <div className="w-14 h-14 rounded-2xl bg-primary/15 border-2 border-primary/50 flex items-center justify-center shadow-[0_0_25px_rgba(0,242,255,0.3)]">
                            <CheckCircle2 className="w-7 h-7 text-primary" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[9px] font-black uppercase tracking-[0.25em]">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            Mission Protocol Completed
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase leading-tight">
                            Mission Submission Complete
                        </h1>
                        <p className="text-gray-400 text-xs leading-relaxed max-w-xs mx-auto">
                            Your assessment for <span className="text-white font-semibold">{quiz?.title}</span> has been securely transmitted and recorded.
                        </p>
                    </div>

                    {/* Compact Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="glass rounded-xl p-3 border border-white/5 space-y-0.5">
                            <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Responses Saved</p>
                            <p className="text-xl font-mono font-black text-white">
                                {totalAnswered} <span className="text-white/30 text-xs">/ {totalQuestions}</span>
                            </p>
                        </div>
                        <div className="glass rounded-xl p-3 border border-white/5 space-y-0.5">
                            <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Protocol Status</p>
                            <div className="flex items-center justify-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#22c55e]" />
                                <span className="text-xs font-black text-green-400 font-mono tracking-wider">VERIFIED</span>
                            </div>
                        </div>
                    </div>

                    {/* Live 10s Countdown Bar & Box */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400 flex items-center gap-1.5 font-mono text-[11px]">
                                <Clock className="w-3 h-3 text-primary" />
                                Auto-redirecting to Home
                            </span>
                            <span className="font-mono font-black text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-xs">
                                {countdown}s
                            </span>
                        </div>
                        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: "100%" }}
                                animate={{ width: `${(countdown / 10) * 100}%` }}
                                transition={{ duration: 1, ease: "linear" }}
                                className="h-full bg-primary shadow-[0_0_8px_#00f2ff]"
                            />
                        </div>
                    </div>

                    {/* Manual Navigation Buttons */}
                    <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="w-full sm:w-auto px-6 py-2.5 bg-primary text-black font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            Return to Home <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/dashboard")}
                            className="w-full sm:w-auto px-5 py-2.5 glass border border-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white/5 transition-all cursor-pointer"
                        >
                            Dashboard
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── 📋 INSTRUCTIONS ─────────────────────────────────────────────
    if (phase === "instructions") {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-start md:justify-center px-4 sm:px-6 pt-36 md:pt-40 pb-20 relative overflow-y-auto">
                <div className="fixed inset-0 grid-bg opacity-5 pointer-events-none" />
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="max-w-2xl w-full glass p-8 md:p-12 rounded-3xl border border-white/10 space-y-8 my-auto relative z-10 shadow-2xl"
                >
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Quiz Unlocked — Ready to Start</span>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">{quiz?.title}</h1>
                        {quiz?.description && (
                            <p className="text-gray-400 text-sm leading-relaxed">{quiz.description}</p>
                        )}
                    </div>

                    {/* Stats — no pass mark */}
                    <div className="grid grid-cols-2 gap-4 text-center py-2">
                        {[
                            { label: "Questions", value: quiz?.questions?.length ?? "—" },
                            { label: "Time Limit", value: `${Math.floor((quiz?.timeLimit ?? 2700) / 60)} min` },
                        ].map((stat) => (
                            <div key={stat.label} className="glass rounded-2xl py-6 border border-white/5">
                                <p className="text-3xl font-black text-primary">{stat.value}</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3">
                        {[
                            { title: "⏱ Timer", desc: `${Math.floor((quiz?.timeLimit ?? 2700) / 60)} minutes — auto-submits when time runs out.` },
                            { title: "🧭 Navigation", desc: "Move freely between questions. Answers are saved as you go." },
                            { title: "🚫 No Refresh", desc: "Don't refresh the browser — your progress may be lost." },
                            { title: "📋 One Attempt Only", desc: "You can only submit once. This quiz cannot be retaken." },
                        ].map((item) => (
                            <div key={item.title} className="flex gap-3 items-start p-4 bg-white/[0.02] rounded-xl border border-white/5">
                                <div>
                                    <p className="text-sm font-bold text-white">{item.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Read carefully before starting
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleStartQuiz}
                            className="w-full sm:w-auto px-10 py-4 bg-primary text-black font-black text-sm uppercase tracking-[0.2em] rounded-xl hover:shadow-[0_0_30px_rgba(0,242,255,0.4)] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                        >
                            <Maximize className="w-4 h-4" />
                            Start Quiz in Fullscreen →
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── 🎯 QUIZ IN PROGRESS ─────────────────────────────────────────
    const question = quiz.questions[currentQuestion];
    const isLast = currentQuestion === quiz.questions.length - 1;

    return (
        <div className="fixed inset-0 z-[150] min-h-screen bg-background pt-8 pb-20 px-6 overflow-y-auto">
            <div className="fixed inset-0 grid-bg opacity-10 pointer-events-none" />
            <div className="max-w-4xl mx-auto relative z-10">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">{quiz.title}</p>
                        <div className="text-3xl font-bold tracking-tighter">
                            Question <span className="text-primary">{String(currentQuestion + 1).padStart(2, "0")}</span>
                            <span className="text-white/20"> / {String(quiz.questions.length).padStart(2, "0")}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={toggleFullscreen}
                            className={`px-4 py-2.5 glass rounded-full border flex items-center gap-2 text-xs font-mono font-bold transition-all cursor-pointer ${
                                isFullscreen
                                    ? "border-primary/40 text-primary bg-primary/10 shadow-[0_0_15px_rgba(0,242,255,0.15)]"
                                    : "border-yellow-500/40 text-yellow-400 bg-yellow-500/10 hover:border-yellow-500 animate-pulse"
                            }`}
                            title={isFullscreen ? "Fullscreen is active" : "Click to enter Fullscreen"}
                        >
                            {isFullscreen ? (
                                <>
                                    <Minimize className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">FULLSCREEN</span>
                                </>
                            ) : (
                                <>
                                    <Maximize className="w-3.5 h-3.5" />
                                    <span>FULLSCREEN MODE</span>
                                </>
                            )}
                        </button>

                        <div className={`px-6 py-3 glass rounded-full border flex items-center gap-3 ${timeLeft < 300 ? "border-red-500/50 bg-red-500/5" : "border-white/10"}`}>
                            <Timer className={`w-4 h-4 ${timeLeft < 300 ? "text-red-500 animate-pulse" : "text-primary"}`} />
                            <span className={`font-mono font-bold text-sm tracking-widest ${timeLeft < 300 ? "text-red-500" : "text-white"}`}>
                                {fmt(timeLeft)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-px w-full bg-white/10 mb-14 relative overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
                        className="absolute left-0 top-0 h-full bg-primary shadow-[0_0_15px_#00f2ff]"
                    />
                </div>

                {/* Question */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentQuestion}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-10"
                    >
                        <h3 className="text-2xl md:text-4xl font-bold leading-tight tracking-tight">{question.text}</h3>

                        {question.code && (
                            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                                <div className="h-10 bg-[#1e1e1e] flex items-center px-4 gap-2 border-b border-white/5">
                                    {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
                                        <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
                                    ))}
                                    <span className="ml-4 text-[10px] text-gray-500 font-mono uppercase tracking-widest">source.js</span>
                                </div>
                                <pre className="bg-[#1e1e1e] p-6 font-mono text-sm text-primary/90 overflow-x-auto whitespace-pre-wrap">
                                    <code>{question.code}</code>
                                </pre>
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-4">
                            {question.options.map((opt: any, idx: number) => {
                                const selected = answers[question.id] === opt.id;
                                return (
                                    <motion.button
                                        key={opt.id}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => handleOptionSelect(opt.id)}
                                        className={`group relative flex items-center justify-between p-7 rounded-2xl border text-left transition-all ${
                                            selected
                                                ? "bg-white text-black border-white shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                                                : "bg-white/[0.03] border-white/10 hover:border-white/30"
                                        }`}
                                    >
                                        <div className="space-y-1">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${selected ? "text-black/40" : "text-white/20"}`}>
                                                {String.fromCharCode(65 + idx)}
                                            </span>
                                            <div className="text-base font-bold leading-snug">{opt.text}</div>
                                        </div>
                                        {selected && (
                                            <div className="p-2 bg-black rounded-lg shrink-0 ml-4">
                                                <CheckCircle2 className="w-5 h-5 text-white" />
                                            </div>
                                        )}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-16 pt-8 border-t border-white/5">
                    <button
                        onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))}
                        disabled={currentQuestion === 0}
                        className="flex items-center gap-2 px-6 py-3 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all disabled:opacity-0"
                    >
                        <ArrowLeft className="w-4 h-4" /> Previous
                    </button>

                    {isLast ? (
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-10 py-5 bg-primary text-black font-black text-sm uppercase tracking-widest rounded-full hover:shadow-[0_0_30px_rgba(0,242,255,0.4)] transition-all flex items-center gap-3 disabled:opacity-50"
                        >
                            {submitting
                                ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                                : <>Submit Quiz <Zap className="w-5 h-5" /></>
                            }
                        </motion.button>
                    ) : (
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setCurrentQuestion((p) => p + 1)}
                            disabled={!answers[question.id]}
                            className="flex items-center gap-3 px-10 py-5 bg-white text-black font-black text-sm uppercase tracking-widest rounded-full hover:bg-primary transition-all disabled:opacity-50"
                        >
                            Next <ArrowRight className="w-5 h-5" />
                        </motion.button>
                    )}
                </div>
            </div>

            {/* ─── 🛡️ CONCURRENCY & SUBMISSION QUEUE MODAL OVERLAY ─── */}
            <AnimatePresence>
                {submitStatus.active && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="max-w-md w-full glass p-8 md:p-10 rounded-[2.5rem] border border-white/10 text-center space-y-6 relative overflow-hidden shadow-[0_0_50px_rgba(0,242,255,0.15)]"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />

                            {submitStatus.step === "error" ? (
                                <>
                                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
                                        <WifiOff className="w-9 h-9 text-red-400" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.4em]">Connection Disrupted</p>
                                        <h3 className="text-2xl font-bold tracking-tight text-white">Transmission Delayed</h3>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            {submitStatus.errorMsg}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3 text-left">
                                        <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                                        <p className="text-[11px] text-gray-300">
                                            Your answers are <span className="text-primary font-bold">100% saved locally</span>. No progress was lost.
                                        </p>
                                    </div>

                                    <div className="pt-2 flex flex-col gap-3">
                                        <button
                                            onClick={() => executeSubmit()}
                                            className="w-full py-4 bg-primary text-black font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-[0_0_25px_#00f2ff] transition-all flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw className="w-4 h-4" /> Retry Submission Now
                                        </button>
                                        <button
                                            onClick={() => setSubmitStatus({ ...submitStatus, active: false })}
                                            className="w-full py-3 text-xs text-gray-500 hover:text-white uppercase tracking-widest transition-all"
                                        >
                                            Review Answers First
                                        </button>
                                    </div>
                                </>
                            ) : submitStatus.step === "success" ? (
                                <>
                                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/30">
                                        <CheckCircle2 className="w-10 h-10 text-primary animate-pulse" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Transmission Complete</p>
                                        <h3 className="text-2xl font-bold tracking-tight text-white">Mission Acknowledged</h3>
                                        <p className="text-xs text-gray-400">
                                            Submission recorded successfully in mainframe. Redirecting to dashboard...
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-xs text-primary/70 font-mono">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Finalizing protocol...
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="relative w-20 h-20 mx-auto">
                                        <div className="w-20 h-20 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
                                        <Zap className="absolute inset-center w-7 h-7 text-primary animate-pulse" />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                                            <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
                                                {submitStatus.step === "encrypting" ? "Encrypting Answers" : "Mission Queue Processing"}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-bold tracking-tight text-white">
                                            {submitStatus.attempt > 1 ? `Retrying Stream (Attempt ${submitStatus.attempt}/${submitStatus.maxAttempts})` : "Submitting Quiz"}
                                        </h3>
                                        <p className="text-xs text-gray-400 max-w-xs mx-auto">
                                            {submitStatus.attempt > 1
                                                ? "Heavy exam traffic detected. Queued for transmission — please do not close this window."
                                                : "Syncing your answers with the central server. This takes just a moment..."}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs font-mono">
                                        <span className="text-gray-500">Local Safeguard</span>
                                        <span className="text-primary font-bold flex items-center gap-1.5">
                                            <ShieldCheck className="w-3.5 h-3.5" /> Answers Cached
                                        </span>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
