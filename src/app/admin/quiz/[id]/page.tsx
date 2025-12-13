
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { database } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { motion } from "framer-motion";

export default function QuizControlPanel() {
    const { id } = useParams();
    const router = useRouter();
    const [quiz, setQuiz] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);

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
                    // Sort by score descending
                    if (b.score !== a.score) {
                        return b.score - a.score;
                    }
                    // Tie-breaker: lastAnswerTime (earlier is better/faster)
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
    }

    if (!quiz) return <div className="p-8 text-white">Loading quiz...</div>;

    const currentQ = quiz.questions?.[quiz.state.currentQuestionIndex];

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-start mb-12">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">{quiz.info?.title}</h1>
                        <div className="flex items-center gap-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${quiz.state.status === "active" ? "bg-green-500/20 text-green-400" :
                                quiz.state.status === "finished" ? "bg-red-500/20 text-red-400" :
                                    "bg-yellow-500/20 text-yellow-400"
                                }`}>
                                {quiz.state.status.toUpperCase()}
                            </span>
                            <span className="text-gray-400">
                                👥 {participants.length} Live Players
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push("/admin/dashboard")}
                        className="text-gray-400 hover:text-white"
                    >
                        ← Back to Dashboard
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Controls */}
                    <div className="lg:col-span-1 bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4 h-fit">
                        <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">
                            Game Controls
                        </h2>

                        {quiz.state.status === "waiting" && (
                            <button
                                onClick={startQuiz}
                                className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-lg shadow-lg shadow-green-900/20 transition-all"
                            >
                                ▶ Start Quiz
                            </button>
                        )}

                        {quiz.state.status === "active" && (
                            <>
                                <button
                                    onClick={toggleResults}
                                    className={`w-full py-3 rounded-lg font-semibold transition-colors ${quiz.state.showResult
                                        ? "bg-purple-600 hover:bg-purple-500"
                                        : "bg-blue-600 hover:bg-blue-500"
                                        }`}
                                >
                                    {quiz.state.showResult ? "Hide Leaderboard (Player View)" : "Show Leaderboard (Player View)"}
                                </button>

                                <button
                                    onClick={nextQuestion}
                                    className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
                                >
                                    Next Question →
                                </button>

                                <button
                                    onClick={stopQuiz}
                                    className="w-full py-3 border border-red-500 text-red-400 hover:bg-red-500/10 rounded-lg font-semibold mt-4"
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
                        <div className="bg-black/50 p-6 rounded-2xl border border-gray-800">
                            <h2 className="text-sm uppercase text-gray-500 mb-4 font-bold tracking-wider">
                                Live Preview
                            </h2>

                            {quiz.state.status === "waiting" && (
                                <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-900/50 rounded-xl border border-gray-800 border-dashed">
                                    <div className="text-4xl mb-4">⏳</div>
                                    <h3 className="text-xl font-bold">Waiting Content</h3>
                                    <p className="text-gray-400">Players see the lobby screen.</p>
                                </div>
                            )}

                            {quiz.state.status === "active" && !quiz.state.showResult && currentQ && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-sm text-gray-400">
                                        <span>Q{quiz.state.currentQuestionIndex + 1}</span>
                                        <span>{currentQ.timeLimit}s</span>
                                    </div>
                                    <p className="font-medium text-lg">{currentQ.text}</p>
                                    {currentQ.imageUrl && (
                                        <img src={currentQ.imageUrl} className="w-full h-32 object-cover rounded-lg" alt="Q" />
                                    )}
                                    <div className="grid grid-cols-2 gap-2">
                                        {currentQ.options.map((opt: string, i: number) => (
                                            <div key={i} className={`p-2 rounded border text-sm ${i === currentQ.correctIndex ? "border-green-500 bg-green-500/10" : "border-gray-700"
                                                }`}>
                                                {opt}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {quiz.state.showResult && (
                                <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-900/50 rounded-xl border border-gray-800 border-dashed">
                                    <div className="text-4xl mb-4">🏆</div>
                                    <h3 className="text-xl font-bold">Leaderboard View</h3>
                                    <p className="text-gray-400">Players are seeing the top 5 scores.</p>
                                </div>
                            )}

                            {quiz.state.status === "finished" && !quiz.state.showResult && (
                                <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-900/50 rounded-xl border border-gray-800 border-dashed">
                                    <h3 className="text-xl font-bold">Game Over Screen</h3>
                                </div>
                            )}
                        </div>

                        {/* Admin Real-time Leaderboard */}
                        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                            <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                                <span>Participants & Scores</span>
                                <span className="text-sm font-normal text-gray-400 bg-gray-700 px-2 py-1 rounded">
                                    {participants.length} Total
                                </span>
                            </h2>

                            {participants.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">Waiting for players to join...</p>
                            ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {participants.map((p: any, i: number) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50 border border-gray-700"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-yellow-500 text-black" :
                                                        i === 1 ? "bg-gray-400 text-black" :
                                                            i === 2 ? "bg-orange-700 text-white" : "bg-gray-600 text-gray-300"
                                                    }`}>
                                                    {i + 1}
                                                </span>
                                                <span className="font-semibold">{p.name || "Use named"}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm text-gray-400 hidden sm:block">
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
