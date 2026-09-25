import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getQuizzes, getUserResults, getAllResults } from "@/actions/quiz";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
    Zap, Clock, Trophy, ArrowRight, Database, LayoutDashboard,
    Activity, User, Shield, Lock, CheckCircle2, AlertCircle
} from "lucide-react";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const isAdmin = session.user?.role === "ADMIN";

    // Fetch quizzes, user results (participants only), and admin data in parallel
    const [quizzes, results, allResultsData] = await Promise.all([
        getQuizzes(),
        !isAdmin ? getUserResults() : Promise.resolve([]),
        isAdmin ? getAllResults() : Promise.resolve([]),
    ]);

    // For participants: get their access statuses
    let accessMap: Record<string, { isGranted: boolean }> = {};
    if (!isAdmin && session.user?.id) {
        const accesses = await prisma.quizAccess.findMany({
            where: { userId: session.user.id },
            select: { quizId: true, isGranted: true },
        });
        accessMap = Object.fromEntries(accesses.map((a) => [a.quizId, { isGranted: a.isGranted }]));
    }

    // For participants: map of quizId → result
    const resultMap = Object.fromEntries(
        (results as any[]).map((r: any) => [r.quizId, r])
    );

    return (
        <div className="min-h-screen bg-background pt-32 pb-20 px-6 relative overflow-hidden">
            <div className="fixed inset-0 grid-bg opacity-10 pointer-events-none" />

            <div className="max-w-7xl mx-auto relative space-y-16">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-3">
                        <h2 className="text-xs font-black uppercase tracking-[0.5em] text-primary">
                            {isAdmin ? "Admin Command Center" : "ACM Recruitment 2026"}
                        </h2>
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter uppercase">
                            WELCOME, {session?.user?.name ? session.user.name.split(" ")[0] : "CANDIDATE"}
                        </h1>
                        {isAdmin && (
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full text-primary text-xs font-black uppercase tracking-widest">
                                <Zap className="w-3.5 h-3.5" /> Administrator Access
                            </div>
                        )}
                    </div>

                    {/* Quick stats for participants */}
                    {!isAdmin && (results as any[]).length > 0 && (
                        <div className="flex gap-4">
                            <div className="glass p-4 rounded-2xl border border-white/10 text-center min-w-[80px]">
                                <p className="text-2xl font-black text-primary">{(results as any[]).length}</p>
                                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">Completed</p>
                            </div>
                            <div className="glass p-4 rounded-2xl border border-white/10 text-center min-w-[80px]">
                                <p className="text-2xl font-black text-white">
                                    {(results as any[]).filter((r: any) => r.status === "PASS").length}
                                </p>
                                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">Passed</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Admin quick links */}
                {isAdmin && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { href: "/admin/access", label: "Access Control", icon: Shield, color: "text-secondary", bg: "bg-secondary/10 border-secondary/30", desc: "Grant participant access" },
                            { href: "/admin/quiz", label: "Quiz Manager", icon: LayoutDashboard, color: "text-primary", bg: "bg-primary/10 border-primary/30", desc: "Create & manage quizzes" },
                            { href: "/admin/leaderboard", label: "Live Leaderboard", icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", desc: "Real-time scores" },
                            { href: "/admin/quiz/new", label: "New Quiz", icon: Zap, color: "text-white", bg: "bg-white/5 border-white/10", desc: "Deploy a new mission" },
                        ].map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`glass p-6 rounded-2xl border ${item.bg} hover:scale-105 transition-all group space-y-3`}
                            >
                                <item.icon className={`w-6 h-6 ${item.color}`} />
                                <div>
                                    <p className="text-sm font-black uppercase tracking-widest">{item.label}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{item.desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                <div className="grid lg:grid-cols-12 gap-12">

                    {/* Quizzes */}
                    <div className="lg:col-span-8 space-y-8">
                        <div className="flex items-center justify-between border-b border-white/5 pb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <h3 className="text-sm font-black uppercase tracking-[0.3em]">Round 1 Assessments</h3>
                            </div>
                            {isAdmin && (
                                <Link
                                    href="/admin/quiz"
                                    className="px-6 py-3 bg-white text-black text-xs font-black uppercase tracking-widest rounded-full hover:bg-primary transition-all flex items-center gap-2"
                                >
                                    <LayoutDashboard className="w-3.5 h-3.5" /> Manage
                                </Link>
                            )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-px bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
                            {quizzes.length > 0 ? (
                                (quizzes as any[]).map((quiz: any) => {
                                    const access = accessMap[quiz.id];
                                    const result = resultMap[quiz.id];
                                    const hasSubmitted = !!result;
                                    const hasAccess = access?.isGranted;
                                    const hasPending = access && !access.isGranted;

                                    return (
                                        <Link
                                            key={quiz.id}
                                            href={hasSubmitted ? "#" : `/quiz/${quiz.id}`}
                                            className={`bg-background group p-8 space-y-6 hover:bg-white/[0.02] transition-colors relative ${hasSubmitted ? "opacity-60 cursor-default pointer-events-none" : ""}`}
                                        >
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs font-black uppercase tracking-widest px-3 py-1 bg-white/5 rounded-full border border-white/10 text-gray-400">
                                                        {quiz.category}
                                                    </span>
                                                    <div className="text-xs font-mono text-gray-600 uppercase tracking-widest">
                                                        {quiz.difficulty}
                                                    </div>
                                                </div>

                                                <h4 className="text-2xl font-bold tracking-tight group-hover:text-primary transition-colors leading-tight">
                                                    {quiz.title}
                                                </h4>
                                                <p className="text-gray-500 text-sm font-light leading-relaxed line-clamp-2">
                                                    {quiz.description || "No description provided."}
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-gray-600">
                                                    <span className="flex items-center gap-1.5">
                                                        <Database className="w-3 h-3" /> {quiz._count.questions} Q's
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <Clock className="w-3 h-3" /> {Math.floor((quiz.timeLimit ?? 2700) / 60)}m
                                                    </span>
                                                </div>

                                                {/* Access status badge */}
                                                {!isAdmin && (
                                                    <div>
                                                        {hasSubmitted ? (
                                                            <span className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest">
                                                                <CheckCircle2 className="w-3 h-3" /> Submitted
                                                            </span>
                                                        ) : hasAccess ? (
                                                            <span className="flex items-center gap-1 text-[10px] font-black text-green-400 uppercase tracking-widest animate-pulse">
                                                                <Zap className="w-3 h-3" /> Start
                                                            </span>
                                                        ) : hasPending ? (
                                                            <span className="flex items-center gap-1 text-[10px] font-black text-yellow-400 uppercase tracking-widest">
                                                                <AlertCircle className="w-3 h-3" /> Pending
                                                            </span>
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-hover:border-primary group-hover:text-primary transition-all">
                                                                <ArrowRight className="w-4 h-4" />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Bottom highlight bar */}
                                            <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary group-hover:w-full transition-all duration-500" />
                                        </Link>
                                    );
                                })
                            ) : (
                                <div className="md:col-span-2 p-20 text-center space-y-4">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Zap className="w-8 h-8 text-gray-600" />
                                    </div>
                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
                                        Sector Clear. No missions detected.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-6">
                            <div className={`w-2 h-2 rounded-full ${isAdmin ? "bg-primary shadow-[0_0_5px_#00f2ff]" : "bg-secondary"}`} />
                            <h3 className="text-sm font-black uppercase tracking-[0.3em]">
                                {isAdmin ? "All Scores" : "Mission Status"}
                            </h3>
                        </div>

                        <div className="space-y-3">
                            {isAdmin ? (
                                (allResultsData as any[]).length > 0 ? (
                                    (allResultsData as any[]).slice(0, 10).map((result: any) => (
                                        <div
                                            key={result.id}
                                            className="glass p-5 rounded-2xl border border-white/10 hover:border-primary/30 transition-all"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-[9px] font-black">
                                                        {result.user?.name?.charAt(0) || "?"}
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-widest">{result.user?.name || "Anonymous"}</span>
                                                    {result.user?.program && (
                                                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                                            {result.user.program}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-base font-black ${result.status === "PASS" ? "text-primary" : "text-red-500"}`}>
                                                    {result.percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.15em] text-gray-600">
                                                <span>{result.quiz?.title}</span>
                                                <div className="flex items-center gap-3">
                                                    {typeof result.timeTaken === "number" && (
                                                        <span>{Math.floor(result.timeTaken / 60)}:{String(result.timeTaken % 60).padStart(2, "0")}</span>
                                                    )}
                                                    <span>{result.score}/{result.total}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="glass p-10 rounded-2xl border border-dashed border-white/10 text-center">
                                        <Activity className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                                        <p className="text-gray-600 text-xs font-black uppercase tracking-widest">No submissions yet</p>
                                    </div>
                                )
                            ) : (
                                <div className="glass p-10 rounded-2xl border border-dashed border-white/10 text-center space-y-4">
                                    <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center mx-auto border border-secondary/20">
                                        <Lock className="w-5 h-5 text-secondary" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-white font-bold uppercase tracking-widest text-xs">Encrypted Phase</p>
                                        <p className="text-gray-600 text-[10px] uppercase tracking-widest leading-relaxed">
                                            Results are secured. Participants cannot view others' scores.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {isAdmin && (allResultsData as any[]).length > 10 && (
                                <Link
                                    href="/admin/leaderboard"
                                    className="block text-center py-3 glass border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-primary hover:border-primary/50 transition-all"
                                >
                                    View Full Leaderboard ({(allResultsData as any[]).length} entries)
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
