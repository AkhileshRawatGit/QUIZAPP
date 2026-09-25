"use client";

import { useEffect, useRef } from "react";

export function CodeBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initColumns();
        };

        window.addEventListener("resize", handleResize);

        // Tech & Coding tokens curated for ACM Student Chapter
        const codeTokens = [
            "const acm = new Chapter();",
            "async function solve(dp, graph) {",
            "return dfs(root, visited);",
            "if (score >= cutoff) qualify();",
            "O(N log N) -> binarySearch()",
            "while (queue.length > 0) {",
            "import { ACM } from '@recruitment';",
            "select * from candidates where pass = true;",
            "01100001 01100011 01101101",
            "git commit -m 'Round 1 cleared'",
            "const [state, setState] = useState();",
            "std::vector<int> adj[MAXN];",
            "dp[i][j] = min(dp[i-1][j], cost);",
            "0x7FFF8A4C",
            "fn main() -> Result<(), Error>",
            "curl -X POST /api/submit",
            "docker run -d -p 3000:3000 acm",
            "socket.emit('live_leaderboard');",
            "int mid = l + (r - l) / 2;",
            "lambda x, y: x ^ y",
            "{ status: 200, qualified: true }",
            "export default RoundOneScreening;",
            "Math.max(...scores)",
            "System.out.println('ACM 2026');",
            "01010011 01010101 01000011",
            "prisma.result.create({ data });",
            "struct Node* next = NULL;",
            "SELECT rank, candidate FROM leaderboard;",
            "hash.update(seed).digest('hex')",
            "priority_queue<pair<int,int>> pq;"
        ];

        const charTokens = "01{}[]<>=/;:*+-_~#!?$&@abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

        interface Column {
            x: number;
            y: number;
            speed: number;
            fontSize: number;
            isSnippet: boolean;
            snippetText: string;
            charIndex: number;
            opacity: number;
            nextChange: number;
        }

        let columns: Column[] = [];

        function initColumns() {
            columns = [];
            const colWidth = 32;
            const colCount = Math.floor(width / colWidth);

            for (let i = 0; i < colCount; i++) {
                const isSnippet = Math.random() < 0.25; // 25% are full code statements
                columns.push({
                    x: i * colWidth + Math.random() * 8,
                    y: Math.random() * -height,
                    speed: 1.2 + Math.random() * 2.2,
                    fontSize: 11 + Math.floor(Math.random() * 4),
                    isSnippet,
                    snippetText: codeTokens[Math.floor(Math.random() * codeTokens.length)],
                    charIndex: 0,
                    opacity: 0.2 + Math.random() * 0.5,
                    nextChange: 0,
                });
            }
        }

        initColumns();

        let lastTime = 0;
        const fps = 35; // optimal smooth fps without battery/GPU strain
        const interval = 1000 / fps;

        const render = (time: number) => {
            animationFrameId = requestAnimationFrame(render);

            const delta = time - lastTime;
            if (delta < interval) return;
            lastTime = time - (delta % interval);

            // Semi-transparent fade background to create trail effect
            ctx.fillStyle = "rgba(2, 4, 10, 0.15)";
            ctx.fillRect(0, 0, width, height);

            ctx.font = "12px 'Space Grotesk', 'Courier New', monospace";

            for (let i = 0; i < columns.length; i++) {
                const col = columns[i];

                if (col.isSnippet) {
                    // Render code snippet string
                    const char = col.snippetText[col.charIndex % col.snippetText.length];

                    // Bright cyan glowing head
                    ctx.fillStyle = "rgba(0, 242, 255, 0.85)";
                    ctx.shadowColor = "#00f2ff";
                    ctx.shadowBlur = 8;
                    ctx.fillText(char, col.x, col.y);

                    // Trailing characters
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = `rgba(0, 242, 255, ${col.opacity * 0.4})`;
                    ctx.fillText(char, col.x, col.y - 14);

                    col.charIndex++;
                    col.y += col.fontSize * 1.2;

                    if (col.charIndex >= col.snippetText.length) {
                        col.snippetText = codeTokens[Math.floor(Math.random() * codeTokens.length)];
                        col.charIndex = 0;
                        col.y += 24; // extra gap between sentences
                    }
                } else {
                    // Render random matrix characters / binary
                    const char = charTokens[Math.floor(Math.random() * charTokens.length)];

                    // Head character (electric cyan / purple)
                    const isPurple = i % 3 === 0;
                    if (isPurple) {
                        ctx.fillStyle = "rgba(168, 85, 247, 0.85)";
                        ctx.shadowColor = "#a855f7";
                    } else {
                        ctx.fillStyle = "rgba(0, 242, 255, 0.85)";
                        ctx.shadowColor = "#00f2ff";
                    }
                    ctx.shadowBlur = 6;
                    ctx.fillText(char, col.x, col.y);

                    // Faded trail
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = isPurple
                        ? `rgba(168, 85, 247, ${col.opacity * 0.3})`
                        : `rgba(0, 242, 255, ${col.opacity * 0.3})`;
                    ctx.fillText(char, col.x, col.y - 14);

                    col.y += col.fontSize * 1.1;
                }

                // Reset column when it goes off screen
                if (col.y > height + 60) {
                    col.y = -40;
                    col.speed = 1.2 + Math.random() * 2.2;
                    col.isSnippet = Math.random() < 0.28;
                    col.snippetText = codeTokens[Math.floor(Math.random() * codeTokens.length)];
                    col.charIndex = 0;
                    col.opacity = 0.2 + Math.random() * 0.5;
                }
            }
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            window.removeEventListener("resize", handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Dark vignette gradient overlay to keep foreground text ultra-readable */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#02040a]/70 via-transparent to-[#02040a]/90 z-10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#02040a_85%)] z-10" />

            <canvas
                ref={canvasRef}
                className="w-full h-full opacity-35"
                style={{ filter: "contrast(120%)" }}
            />
        </div>
    );
}

export default CodeBackground;
