
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { database } from "@/lib/firebase";
import { ref, onValue, update, remove } from "firebase/database";
import { motion } from "framer-motion";
import clsx from "clsx";

export default function QuizControlPanel() {
    const { id } = useParams();
    const router = useRouter();
    const [quiz, setQuiz] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);

    // Timer and Auto-Advance Logic
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!id) return;
        const quizRef = ref(database, `quizzes/${id}`);
        const participantsRef = ref(database, `quizzes/${id}/participants`);

        const unsubQuiz = onValue(quizRef, (snapshot) => {
            setQuiz(snapshot.val());
        });

        const unsubParticipants = onValue(participantsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.values(data).sort((a: any, b: any) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return (a.lastAnswerTime || Number.MAX_VALUE) - (b.lastAnswerTime || Number.MAX_VALUE);
                });
                setParticipants(list);
            } else {
                setParticipants([]);
            }
        });

        return () => {
            unsubQuiz();
            unsubParticipants();
        };
    }, [id]);

    // Game Loop Effect
    useEffect(() => {
        if (!quiz || quiz.state.status !== "active") return;

        let interval: NodeJS.Timeout;
        let timeout: NodeJS.Timeout;

        // 1. Question Timer (Show Result is FALSE)
        if (!quiz.state.showResult) {
            const currentQ = quiz.questions?.[quiz.state.currentQuestionIndex];
            const limit = currentQ?.timeLimit || 20;

            // Only set time left if we just entered this state (this is tricky with just useEffect, 
            // simplifiction: we set it and if it drifts it drifts. Host is authority.)
            // Better: We track it locally. The issue is React re-renders. 
            // We'll set it once when index changes.
            if (timeLeft === 0) setTimeLeft(limit);

            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        // Trigger Leaderboard
                        updateState({ showResult: true });
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        // 2. Leaderboard Timer (Show Result is TRUE)
        else {
            // Wait 5 seconds then go to next question
            timeout = setTimeout(() => {
                nextQuestion();
            }, 20000);
        }

        return () => {
            if (interval) clearInterval(interval);
            if (timeout) clearTimeout(timeout);
        };
    }, [quiz?.state?.status, quiz?.state?.showResult, quiz?.state?.currentQuestionIndex]); // Dependency on these triggers the effect when phase changes

    // Reset timer when question changes
    useEffect(() => {
        if (quiz?.questions?.[quiz?.state?.currentQuestionIndex]?.timeLimit) {
            setTimeLeft(quiz.questions[quiz.state.currentQuestionIndex].timeLimit);
        }
    }, [quiz?.state?.currentQuestionIndex]);

    const updateState = async (updates: any) => {
        if (!id) return;
        try {
            await update(ref(database, `quizzes/${id}/state`), updates);
        } catch (error) {
            console.error("Failed to update state", error);
        }
    };

    const startQuiz = () => {
        updateState({ status: "active", currentQuestionIndex: 0, showResult: false });
    };

    const nextQuestion = () => {
        if (!quiz) return;
        const nextIndex = quiz.state.currentQuestionIndex + 1;
        if (nextIndex < (quiz.questions?.length || 0)) {
            updateState({ currentQuestionIndex: nextIndex, showResult: false });
        } else {
            updateState({ status: "finished", showResult: true });
        }
    };

    const toggleResults = () => {
        updateState({ showResult: !quiz?.state?.showResult });
    };

    const stopQuiz = () => {
        updateState({ status: "finished" });
    };

    const resetQuiz = () => {
        updateState({ status: "waiting", currentQuestionIndex: -1, showResult: false });
        remove(ref(database, `quizzes/${id}/participants`));
    }

    if (!quiz) return <div className="p-8 text-white">Loading quiz...</div>;

    const currentQ = quiz.questions?.[quiz.state.currentQuestionIndex];

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-start mb-12">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 tracking-tight">{quiz.info?.title}</h1>
                        <div className="flex items-center gap-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${quiz.state.status === "active" ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/50" :
                                quiz.state.status === "finished" ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/50" :
                                    "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50"
                                }`}>
                                {quiz.state.status.toUpperCase()}
                            </span>
                            <span className="text-neutral-400 font-medium">
                                👥 {participants.length} Live Players
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push("/admin/dashboard")}
                        className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2 font-bold text-sm"
                    >
                        ← Back to Dashboard
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Controls */}
                    <div className="lg:col-span-1 bg-neutral-900 p-6 rounded-2xl border border-neutral-800 space-y-4 h-fit shadow-xl">
                        <h2 className="text-xl font-bold mb-4 border-b border-neutral-800 pb-2 text-white">
                            Game Controls
                        </h2>

                        {quiz.state.status === "waiting" && (
                            <button
                                onClick={startQuiz}
                                className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-lg shadow-lg shadow-green-900/20 transition-all hover:scale-[1.02]"
                            >
                                ▶ Start Quiz
                            </button>
                        )}

                        {quiz.state.status === "active" && (
                            <>
                                <button
                                    onClick={toggleResults}
                                    className={`w-full py-3 rounded-xl font-bold transition-all hover:scale-[1.02] shadow-lg ${quiz.state.showResult
                                        ? "bg-purple-600 hover:bg-purple-500 shadow-purple-900/20"
                                        : "bg-blue-600 hover:bg-blue-500 shadow-blue-900/20"
                                        }`}
                                >
                                    {quiz.state.showResult ? "Hide Leaderboard" : "Show Leaderboard"}
                                </button>

                                <button
                                    onClick={nextQuestion}
                                    className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-bold border border-neutral-700 transition-all"
                                >
                                    Next Question →
                                </button>

                                <button
                                    onClick={stopQuiz}
                                    className="w-full py-3 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-xl font-bold mt-4 transition-all"
                                >
                                    End Game
                                </button>
                            </>
                        )}

                        {quiz.state.status === "finished" && (
                            <button
                                onClick={resetQuiz}
                                className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold text-lg shadow-lg shadow-yellow-900/20 transition-all"
                            >
                                ↺ Reset Quiz
                            </button>
                        )}

                    </div>

                    {/* Live View / Leaderboard */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Live Question Preview */}
                        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-xl overflow-hidden relative">
                            <h2 className="text-xs uppercase text-neutral-500 mb-4 font-bold tracking-widest border-b border-neutral-800 pb-2">
                                Live Preview (What Students See)
                            </h2>

                            {quiz.state.status === "waiting" && (
                                <div className="flex flex-col items-center justify-center p-12 text-center bg-neutral-950/50 rounded-xl border border-neutral-800 border-dashed">
                                    <div className="text-5xl mb-6 animate-pulse">⏳</div>
                                    <h3 className="text-xl font-bold mb-2">Waiting Room</h3>
                                    <p className="text-neutral-500">Players are staring at the lobby screen.</p>
                                </div>
                            )}

                            {quiz.state.status === "active" && !quiz.state.showResult && currentQ && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <span className="text-neutral-400 font-bold bg-neutral-800 px-3 py-1 rounded-lg">
                                            Q{quiz.state.currentQuestionIndex + 1}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl font-black text-blue-500 font-mono w-[3ch] text-right">
                                                {timeLeft}
                                            </span>
                                            <span className="text-xs font-bold text-neutral-500 mt-1">SEC</span>
                                        </div>
                                    </div>

                                    {/* Timer Bar */}
                                    <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-blue-500"
                                            initial={{ width: "100%" }}
                                            animate={{ width: `${(timeLeft / (currentQ.timeLimit || 20)) * 100}%` }}
                                            transition={{ ease: "linear", duration: 0.5 }} // Smooth updates
                                        />
                                    </div>

                                    <p className="font-bold text-2xl leading-relaxed">{currentQ.text}</p>

                                    {currentQ.imageUrl && (
                                        <img src={currentQ.imageUrl} className="w-full h-48 object-cover rounded-xl border border-neutral-800" alt="Q" />
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        {currentQ.options.map((opt: string, i: number) => (
                                            <div key={i} className={`p-4 rounded-xl border font-semibold text-sm transition-all ${i === currentQ.correctIndex
                                                ? "border-green-500/50 bg-green-500/10 text-green-400"
                                                : "border-neutral-800 bg-neutral-800/50 text-neutral-400"
                                                }`}>
                                                {opt}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {quiz.state.showResult && (
                                <div className="flex flex-col items-center justify-center p-12 text-center bg-neutral-950/50 rounded-xl border border-neutral-800 border-dashed">
                                    <div className="text-5xl mb-6">🏆</div>
                                    <h3 className="text-xl font-bold mb-2">Leaderboard Display</h3>
                                    <p className="text-neutral-500">Showing Top 5 to everyone.</p>
                                    <p className="text-xs text-blue-500 mt-4 font-bold uppercase tracking-widest animate-pulse">Next Q in 20s...</p>
                                </div>
                            )}

                            {quiz.state.status === "finished" && !quiz.state.showResult && (
                                <div className="flex flex-col items-center justify-center p-12 text-center bg-neutral-950/50 rounded-xl border border-neutral-800 border-dashed">
                                    <h3 className="text-xl font-bold text-white">Game Over Screen</h3>
                                    <p className="text-neutral-500 mt-2">Final scores displayed.</p>
                                </div>
                            )}
                        </div>

                        {/* Admin Real-time Leaderboard */}
                        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-xl">
                            <h2 className="text-lg font-bold mb-4 flex items-center justify-between text-white">
                                <span>All Participants</span>
                                <span className="text-xs font-bold text-neutral-400 bg-neutral-800 px-2 py-1 rounded-md">
                                    {participants.length} Total
                                </span>
                            </h2>

                            {participants.length === 0 ? (
                                <p className="text-neutral-600 text-center py-8 italic">Waiting for players to join...</p>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {participants.map((p: any, i: number) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/30 border border-neutral-800/50 hover:bg-neutral-800 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`w-6 h-6 flex items-center justify-center rounded-md text-xs font-black ${i === 0 ? "bg-yellow-500 text-yellow-950" :
                                                    i === 1 ? "bg-neutral-400 text-neutral-900" :
                                                        i === 2 ? "bg-orange-700 text-orange-100" : "bg-neutral-800 text-neutral-500"
                                                    }`}>
                                                    {i + 1}
                                                </span>
                                                <span className={clsx("font-bold text-sm", i === 0 ? "text-white" : "text-neutral-300")}>{p.name || "Anonymous"}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs text-neutral-600 font-mono hidden sm:block uppercase">
                                                    last: {p.currentAnswerIndex !== undefined && p.currentAnswerIndex !== -1 ? String.fromCharCode(65 + p.currentAnswerIndex) : "-"}
                                                </span>
                                                <span className="font-mono text-blue-400 font-bold">{p.score}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
