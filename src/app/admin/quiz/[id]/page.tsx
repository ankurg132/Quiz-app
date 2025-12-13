
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
    const [participantCount, setParticipantCount] = useState(0);

    useEffect(() => {
        if (!id) return;
        const quizRef = ref(database, `quizzes/${id}`);
        const participantsRef = ref(database, `quizzes/${id}/participants`);

        const unsubQuiz = onValue(quizRef, (snapshot) => {
            setQuiz(snapshot.val());
        });

        const unsubParticipants = onValue(participantsRef, (snapshot) => {
            setParticipantCount(snapshot.size);
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
            <div className="max-w-4xl mx-auto">
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
                                👥 {participantCount} Live Players
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Controls */}
                    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4">
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
                                    {quiz.state.showResult ? "Hide Leaderboard" : "Show Leaderboard"}
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

                    {/* Live View Preview */}
                    <div className="bg-black/50 p-6 rounded-2xl border border-gray-800">
                        <h2 className="text-sm uppercase text-gray-500 mb-4 font-bold tracking-wider">
                            Current Screen
                        </h2>

                        {quiz.state.status === "waiting" && (
                            <div className="flex flex-col items-center justify-center h-64 text-center">
                                <div className="text-6xl mb-4">⏳</div>
                                <h3 className="text-xl font-bold">Waiting Room</h3>
                                <p className="text-gray-400">Players are joining...</p>
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
                            <div className="flex flex-col items-center justify-center h-64 text-center">
                                <div className="text-6xl mb-4">🏆</div>
                                <h3 className="text-xl font-bold">Leaderboard</h3>
                            </div>
                        )}

                        {quiz.state.status === "finished" && !quiz.state.showResult && (
                            <div className="flex flex-col items-center justify-center h-64 text-center">
                                <h3 className="text-xl font-bold">Game Over</h3>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
