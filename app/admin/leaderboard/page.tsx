"use client";

import { useState, useEffect } from "react";
import { getAllResults } from "@/actions/quiz";
import { Trophy, Clock, Target, User, Loader2, Zap, ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LiveLeaderboardPage() {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    async function loadResults() {
        try {
            const data = await getAllResults();
            setResults(data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Failed to fetch results:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadResults();
        const interval = setInterval(loadResults, 5000); // Polling every 5 seconds for live feel
        return () => clearInterval(interval);
    }, []);

    if (loading && results.length === 0) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-8">
                <div className="relative">
                    <div className="w-24 h-24 border-[4px] border-primary/20 border-t-primary rounded-full animate-spin" />
                    <Zap className="absolute inset-center w-8 h-8 text-primary animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-primary font-black text-xs uppercase tracking-[0.5em]">Synchronizing Mainframe</h2>
                    <p className="text-gray-500 text-[10px] uppercase font-mono tracking-widest">Loading Live Neural Feeds...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex flex-col pt-32 pb-20 px-6">
            <div className="fixed inset-0 grid-bg opacity-10 pointer-events-none" />

            {/* Ambient background effects */}
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-secondary/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-6xl mx-auto w-full relative space-y-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/10 pb-12">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-primary animate-pulse shadow-[0_0_15px_#00f2ff]" />
                            <span className="text-xs font-black uppercase tracking-[0.5em] text-primary">ACM Recruitment 2026 • Live Rankings</span>
                        </div>
                        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter uppercase leading-none">
                            LEADERBOARD
                        </h1>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest">
                            <span className="text-gray-500">Last Sync:</span>
                            <span className="text-white font-mono">{lastUpdated.toLocaleTimeString()}</span>
                        </div>
                        <div className="px-4 py-1.5 glass rounded-full border border-white/10 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Secure Neural Link Active</span>
                        </div>
                    </div>
                </div>

                {/* Top 3 Podium (Optional: Visual representation) */}
                <div className="grid md:grid-cols-3 gap-8 mb-12">
                    {results.slice(0, 3).map((result, idx) => (
                        <motion.div
                            key={result.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`glass p-8 rounded-[2.5rem] border ${idx === 0 ? "border-primary/50 bg-primary/5" : "border-white/10"
                                } relative overflow-hidden group`}
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-10 font-black text-6xl group-hover:scale-110 transition-transform">
                                #{idx + 1}
                            </div>

                            <div className="space-y-6 relative">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${idx === 0 ? "bg-primary text-black" : "bg-white/5 text-gray-400 border-white/10"
                                        }`}>
                                        <Trophy className="w-6 h-6" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xl font-bold tracking-tight truncate">{result.user?.name || "Agent"}</span>
                                            {result.user?.program && (
                                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                                                    {result.user.program}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 truncate">{result.quiz?.title}</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5 flex items-end justify-between">
                                    <div className="space-y-1">
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-500 font-black">Score & Accuracy</span>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black tracking-tighter text-white">
                                                {result.score}<span className="text-base text-gray-400 font-normal">/{result.total}</span>
                                            </span>
                                            <span className="text-xs font-mono font-bold text-primary">
                                                ({result.percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] items-center gap-1.5 font-black uppercase tracking-widest text-gray-500 font-bold block mb-1">Response Time</span>
                                        <div className="text-xs font-mono font-bold text-primary">
                                            {Math.floor(result.timeTaken / 60)}:{String(result.timeTaken % 60).padStart(2, '0')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Full List */}
                <div className="glass rounded-[2rem] border border-white/5 overflow-hidden">
                    <div className="bg-white/5 border-b border-white/5 px-8 py-6 grid grid-cols-12 gap-4 text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                        <div className="col-span-1">Rank</div>
                        <div className="col-span-3">Participant</div>
                        <div className="col-span-3">Program</div>
                        <div className="col-span-2">Assessment</div>
                        <div className="col-span-1 text-center">Score</div>
                        <div className="col-span-2 text-right">Time</div>
                    </div>

                    <div className="divide-y divide-white/[0.03]">
                        <AnimatePresence mode="popLayout">
                            {results.map((result, idx) => (
                                <motion.div
                                    layout
                                    key={result.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="px-8 py-6 grid grid-cols-12 gap-4 items-center group hover:bg-white/[0.01] transition-colors"
                                >
                                    <div className="col-span-1 font-mono text-xs flex items-center">
                                        {idx === 0 ? (
                                            <span className="text-yellow-400 font-black text-sm">#01</span>
                                        ) : idx === 1 ? (
                                            <span className="text-slate-300 font-black text-sm">#02</span>
                                        ) : idx === 2 ? (
                                            <span className="text-amber-500 font-black text-sm">#03</span>
                                        ) : (
                                            <span className="text-gray-500">{(idx + 1).toString().padStart(2, '0')}</span>
                                        )}
                                    </div>
                                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black group-hover:bg-primary group-hover:text-black transition-all shrink-0">
                                            {result.user?.name?.charAt(0) || "A"}
                                        </div>
                                        <span className="text-sm font-bold tracking-tight truncate">{result.user?.name || "Agent"}</span>
                                    </div>
                                    <div className="col-span-3 flex items-center min-w-0">
                                        <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary border border-primary/20 truncate">
                                            {result.user?.program || "—"}
                                        </span>
                                    </div>
                                    <div className="col-span-2 text-xs uppercase tracking-[0.15em] text-gray-400 truncate">
                                        {result.quiz?.title}
                                    </div>
                                    <div className="col-span-1 text-center flex flex-col items-center justify-center">
                                        <div className="font-black text-base tracking-tighter leading-none">
                                            {result.score}<span className="text-xs text-gray-500 font-normal">/{result.total}</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-primary font-bold mt-1">
                                            {result.percentage.toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="col-span-2 text-right font-mono text-xs text-primary/80">
                                        {Math.floor(result.timeTaken / 60)}:{String(result.timeTaken % 60).padStart(2, '0')}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {results.length === 0 && (
                        <div className="p-20 text-center space-y-4">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Target className="w-8 h-8 text-gray-600" />
                            </div>
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No Data Signal Detected</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Scroll Indicator (if needed) */}
            <div className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.5em] text-gray-600 animate-pulse">
                Awaiting Peripheral Transmissions...
            </div>
        </div>
    );
}
