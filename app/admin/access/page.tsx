"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    getAllQuizzes,
    getAllUsersWithAccessStatus,
    grantAccess,
    revokeAccess,
    grantAllPendingAccess,
    grantAllUsersAccess,
} from "@/actions/quiz";
import {
    ChevronLeft,
    Shield,
    Users,
    CheckCircle2,
    XCircle,
    Clock,
    Trophy,
    Loader2,
    Zap,
    RefreshCw,
    UserCheck,
    UserX,
    AlertTriangle,
    BarChart3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Quiz {
    id: string;
    title: string;
    category: string;
    difficulty: string;
    _count: { questions: number; results: number; accesses: number };
}

interface UserWithAccess {
    id: string;
    name: string | null;
    email: string | null;
    program?: string | null;
    createdAt: Date;
    quizAccesses: { isGranted: boolean; grantedAt: Date | null; createdAt: Date }[];
    results: {
        id: string;
        score: number;
        total: number;
        percentage: number;
        status: string;
        timeTaken: number | null;
        createdAt: Date;
    }[];
}

export default function AdminAccessPage() {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [selectedQuizId, setSelectedQuizId] = useState<string>("");
    const [users, setUsers] = useState<UserWithAccess[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Load quizzes on mount
    useEffect(() => {
        async function load() {
            const data = await getAllQuizzes();
            setQuizzes(data as unknown as Quiz[]);
            if (data.length > 0) setSelectedQuizId(data[0].id);
            setLoading(false);
        }
        load();
    }, []);

    // Load users for selected quiz
    const loadUsers = useCallback(async () => {
        if (!selectedQuizId) return;
        setLoadingUsers(true);
        try {
            const data = await getAllUsersWithAccessStatus(selectedQuizId);
            setUsers(data as unknown as UserWithAccess[]);
            setLastUpdated(new Date());
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingUsers(false);
        }
    }, [selectedQuizId]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    // Auto-refresh every 5 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(loadUsers, 5000);
        return () => clearInterval(interval);
    }, [autoRefresh, loadUsers]);

    const handleGrant = async (userId: string, userName: string) => {
        setActionLoading(`grant-${userId}`);
        try {
            await grantAccess(userId, selectedQuizId);
            await loadUsers();
        } catch (err) {
            alert("Failed to grant access");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevoke = async (userId: string) => {
        setActionLoading(`revoke-${userId}`);
        try {
            await revokeAccess(userId, selectedQuizId);
            await loadUsers();
        } catch (err) {
            alert("Failed to revoke access");
        } finally {
            setActionLoading(null);
        }
    };

    const handleGrantAllPending = async () => {
        setActionLoading("grant-all-pending");
        try {
            await grantAllPendingAccess(selectedQuizId);
            await loadUsers();
        } catch (err) {
            alert("Failed to grant all pending");
        } finally {
            setActionLoading(null);
        }
    };

    const handleGrantAll = async () => {
        if (!confirm("Grant access to ALL registered participants?")) return;
        setActionLoading("grant-all");
        try {
            await grantAllUsersAccess(selectedQuizId);
            await loadUsers();
        } catch (err) {
            alert("Failed to grant all");
        } finally {
            setActionLoading(null);
        }
    };

    // ── Derived stats ──
    const stats = {
        total: users.length,
        requested: users.filter((u) => u.quizAccesses.length > 0).length,
        granted: users.filter((u) => u.quizAccesses[0]?.isGranted).length,
        pending: users.filter((u) => u.quizAccesses.length > 0 && !u.quizAccesses[0]?.isGranted).length,
        submitted: users.filter((u) => u.results.length > 0).length,
    };

    const getUserStatus = (user: UserWithAccess) => {
        if (user.results.length > 0) return "submitted";
        if (user.quizAccesses[0]?.isGranted) return "granted";
        if (user.quizAccesses.length > 0) return "pending";
        return "not_requested";
    };

    const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-gray-500 text-sm uppercase tracking-widest">Loading Command Center...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pt-28 pb-20 px-6 relative">
            <div className="fixed inset-0 grid-bg opacity-10 pointer-events-none" />
            <div className="max-w-7xl mx-auto relative space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <Link href="/admin/quiz" className="text-primary flex items-center gap-2 text-sm hover:underline w-fit">
                            <ChevronLeft className="w-4 h-4" /> Back to Mission Command
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-[0_0_10px_#00f2ff]" />
                            <h1 className="text-4xl font-bold tracking-tighter lowercase">access control</h1>
                        </div>
                        <p className="text-gray-400 text-sm">Grant or revoke participant access to quizzes in real-time.</p>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 glass px-4 py-2 rounded-full border border-white/10 text-xs">
                            <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
                            <span className="text-gray-400 uppercase tracking-widest font-bold">
                                {autoRefresh ? "Live" : "Paused"}
                            </span>
                            <button
                                onClick={() => setAutoRefresh(!autoRefresh)}
                                className="ml-2 text-primary hover:underline"
                            >
                                {autoRefresh ? "Pause" : "Resume"}
                            </button>
                        </div>
                        <button
                            onClick={loadUsers}
                            disabled={loadingUsers}
                            className="flex items-center gap-2 glass px-4 py-2 rounded-full border border-white/10 text-xs hover:border-primary/50 transition-all"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? "animate-spin text-primary" : "text-gray-400"}`} />
                            <span className="uppercase tracking-widest font-bold text-gray-400">Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Quiz Selector */}
                <div className="glass p-6 rounded-2xl border border-white/10">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-2 block">
                                Select Recruitment Round / Quiz
                            </label>
                            <select
                                value={selectedQuizId}
                                onChange={(e) => setSelectedQuizId(e.target.value)}
                                className="w-full bg-dark-200 border border-white/10 rounded-xl p-3 focus:border-primary outline-none transition-all text-sm font-bold"
                            >
                                {quizzes.map((q) => (
                                    <option key={q.id} value={q.id}>
                                        {q.title} — {q.category} ({q._count.questions} questions)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-widest text-right">
                            <p className="text-gray-600">Last sync</p>
                            <p className="text-white font-mono">{lastUpdated.toLocaleTimeString()}</p>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: "Registered", value: stats.total, icon: Users, color: "text-white" },
                        { label: "Requested", value: stats.requested, icon: Clock, color: "text-yellow-400" },
                        { label: "Granted", value: stats.granted, icon: CheckCircle2, color: "text-green-400" },
                        { label: "Pending", value: stats.pending, icon: AlertTriangle, color: "text-orange-400" },
                        { label: "Submitted", value: stats.submitted, icon: Trophy, color: "text-primary" },
                    ].map((stat) => (
                        <div key={stat.label} className="glass p-5 rounded-2xl border border-white/10 space-y-2">
                            <stat.icon className={`w-4 h-4 ${stat.color}`} />
                            <p className="text-2xl font-black">{stat.value}</p>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Bulk Actions */}
                {stats.pending > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-yellow-400">
                                    {stats.pending} participant{stats.pending > 1 ? "s" : ""} waiting for access
                                </p>
                                <p className="text-xs text-gray-500">Grant access to let them start the quiz immediately.</p>
                            </div>
                        </div>
                        <button
                            onClick={handleGrantAllPending}
                            disabled={!!actionLoading}
                            className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-yellow-400 transition-all disabled:opacity-50 shrink-0"
                        >
                            {actionLoading === "grant-all-pending" ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <UserCheck className="w-4 h-4" />
                            )}
                            Grant All Pending ({stats.pending})
                        </button>
                    </motion.div>
                )}

                {/* Grant All Button */}
                <div className="flex flex-wrap gap-4">
                    <button
                        onClick={handleGrantAll}
                        disabled={!!actionLoading}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-black font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-[0_0_20px_#00f2ff] transition-all disabled:opacity-50"
                    >
                        {actionLoading === "grant-all" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Zap className="w-4 h-4" />
                        )}
                        Grant All Participants
                    </button>
                    <Link
                        href="/admin/leaderboard"
                        className="flex items-center gap-2 px-6 py-3 glass border border-white/20 font-black text-xs uppercase tracking-widest rounded-xl hover:border-primary/50 transition-all"
                    >
                        <Trophy className="w-4 h-4 text-primary" />
                        Live Leaderboard
                    </Link>
                </div>

                {/* Users Table */}
                <div className="glass rounded-3xl border border-white/10 overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-white/5 border-b border-white/5 px-6 py-4 grid grid-cols-12 gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                        <div className="col-span-1">#</div>
                        <div className="col-span-3">Participant</div>
                        <div className="col-span-3">Email</div>
                        <div className="col-span-2 text-center">Status</div>
                        <div className="col-span-2 text-center">Score</div>
                        <div className="col-span-1 text-right">Action</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-white/[0.03]">
                        {loadingUsers && users.length === 0 ? (
                            <div className="py-20 text-center">
                                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                            </div>
                        ) : users.length === 0 ? (
                            <div className="py-20 text-center space-y-3">
                                <Users className="w-12 h-12 text-gray-600 mx-auto" />
                                <p className="text-gray-500 text-sm uppercase tracking-widest font-bold">No registered participants yet</p>
                            </div>
                        ) : (
                            <AnimatePresence>
                                {users.map((user, idx) => {
                                    const status = getUserStatus(user);
                                    const access = user.quizAccesses[0];
                                    const result = user.results[0];
                                    const isGrantLoading = actionLoading === `grant-${user.id}`;
                                    const isRevokeLoading = actionLoading === `revoke-${user.id}`;

                                    return (
                                        <motion.div
                                            key={user.id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-white/[0.02] transition-colors group"
                                        >
                                            {/* Index */}
                                            <div className="col-span-1 font-mono text-xs text-gray-600">
                                                {String(idx + 1).padStart(2, "0")}
                                            </div>

                                            {/* Name & Program */}
                                            <div className="col-span-3 flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black shrink-0 group-hover:bg-primary/20 group-hover:border-primary/30 transition-all">
                                                    {user.name?.charAt(0)?.toUpperCase() || "?"}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-bold truncate">{user.name || "—"}</span>
                                                    {user.program && (
                                                        <span className="text-[10px] text-primary/80 font-mono font-bold truncate">{user.program}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Email */}
                                            <div className="col-span-3 text-xs text-gray-400 truncate font-mono">
                                                {user.email || "—"}
                                            </div>

                                            {/* Status Badge */}
                                            <div className="col-span-2 flex justify-center">
                                                {status === "submitted" && (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary/20 text-primary border border-primary/30">
                                                        <Trophy className="w-2.5 h-2.5" /> Submitted
                                                    </span>
                                                )}
                                                {status === "granted" && (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-400 border border-green-500/30">
                                                        <CheckCircle2 className="w-2.5 h-2.5" /> Granted
                                                    </span>
                                                )}
                                                {status === "pending" && (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse">
                                                        <Clock className="w-2.5 h-2.5" /> Waiting
                                                    </span>
                                                )}
                                                {status === "not_requested" && (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 text-gray-500 border border-white/10">
                                                        <Shield className="w-2.5 h-2.5" /> Not Started
                                                    </span>
                                                )}
                                            </div>

                                            {/* Score */}
                                            <div className="col-span-2 text-center">
                                                {result ? (
                                                    <div>
                                                        <span className={`text-lg font-black tracking-tighter ${result.status === "PASS" ? "text-primary" : "text-red-400"}`}>
                                                            {result.percentage.toFixed(0)}%
                                                        </span>
                                                        <p className="text-[9px] text-gray-500 font-mono">
                                                            {result.score}/{result.total} •{" "}
                                                            {result.timeTaken
                                                                ? `${Math.floor(result.timeTaken / 60)}:${String(result.timeTaken % 60).padStart(2, "0")}`
                                                                : "—"}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-600 text-xs font-mono">—</span>
                                                )}
                                            </div>

                                            {/* Action */}
                                            <div className="col-span-1 flex justify-end">
                                                {status === "submitted" ? (
                                                    <span className="text-[10px] text-gray-600 font-bold uppercase">Done</span>
                                                ) : access?.isGranted ? (
                                                    <button
                                                        onClick={() => handleRevoke(user.id)}
                                                        disabled={!!actionLoading}
                                                        className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                                                        title="Revoke Access"
                                                    >
                                                        {isRevokeLoading ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <UserX className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleGrant(user.id, user.name || "User")}
                                                        disabled={!!actionLoading}
                                                        className="p-2 rounded-lg text-gray-600 hover:text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-50"
                                                        title="Grant Access"
                                                    >
                                                        {isGrantLoading ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <UserCheck className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-[10px] text-gray-700 uppercase tracking-widest font-bold">
                    ACM Student Chapter Recruitment — Access Control Command Center
                </p>
            </div>
        </div>
    );
}
