
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { database } from "@/lib/firebase";
import { ref, onValue, set, get } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export default function GamePage() {
    const { quizId } = useParams();
    const router = useRouter();
    const [quizState, setQuizState] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState<any>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [myParticipant, setMyParticipant] = useState<any>(null);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);

    // Init
    useEffect(() => {
        const storedUserId = localStorage.getItem("quizUserId");
        if (!storedUserId) {
            router.push("/");
            return;
        }
        setUserId(storedUserId);

        // Fetch static questions once
        const questionsRef = ref(database, `quizzes/${quizId}/questions`);
        get(questionsRef).then((snapshot) => {
            if (snapshot.exists()) {
                setQuestions(snapshot.val());
            }
        });

        // Listen to quiz state
        const stateRef = ref(database, `quizzes/${quizId}/state`);
        const unsubState = onValue(stateRef, (snapshot) => {
            setQuizState(snapshot.val());
        });

        // Listen to my participant data
        const myRef = ref(database, `quizzes/${quizId}/participants/${storedUserId}`);
        const unsubMy = onValue(myRef, (snapshot) => {
            setMyParticipant(snapshot.val());
        });

        // Listen to all participants for leaderboard (optimized: only when showing results might be better, but keeping simple)
        const allParticipantsRef = ref(database, `quizzes/${quizId}/participants`);
        const unsubAll = onValue(allParticipantsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.values(data).sort((a: any, b: any) => {
                    // Sort by score descending
                    if (b.score !== a.score) {
                        return b.score - a.score;
                    }
                    // Tie-breaker: lastAnswerTime (earlier is better/faster)
                    // If one hasn't answered yet/has no time, they are 'slower'
                    return (a.lastAnswerTime || Number.MAX_VALUE) - (b.lastAnswerTime || Number.MAX_VALUE);
                });
                setLeaderboard(list.slice(0, 5)); // Top 5
            }
        });

        return () => {
            unsubState();
            unsubMy();
            unsubAll();
        };
    }, [quizId, router]);

    // Update current question local state when global state index changes
    useEffect(() => {
        if (quizState && questions.length > 0 && quizState.currentQuestionIndex >= 0) {
            setCurrentQuestion(questions[quizState.currentQuestionIndex]);
            // Reset local selection for new question
            if (!isSubmitted) { // Only reset if moving to new question and previous was handled? 
                // Actually, we should track which question we answered. 
                // Simplified: Reset whenever index changes.
                // Problem: If user refreshes, they lose local selection state but server might have it?
                // For MVP: Reset local state on index change.
            }
        }
    }, [quizState?.currentQuestionIndex, questions]);

    // Reset selection when question index changes
    useEffect(() => {
        setSelectedOption(null);
        setIsSubmitted(false);
    }, [quizState?.currentQuestionIndex]);


    const submitAnswer = async (optionIndex: number) => {
        if (!userId || isSubmitted || !quizState || quizState.showResult) return;

        setSelectedOption(optionIndex);
        setIsSubmitted(true);

        const isCorrect = optionIndex === currentQuestion.correctIndex;
        const points = isCorrect ? 10 : 0; // Simple scoring

        // Update server
        // We transactionally update score? Or just set it. 
        // To prevent cheating, server should calc score, but we are doing client-side for MVP.
        const myRef = ref(database, `quizzes/${quizId}/participants/${userId}`);
        // We need to read current score first or use transaction
        // Let's assume we just add to it.

        // Actually, listening to 'myParticipant' gives us current score.
        const newScore = (myParticipant?.score || 0) + points;

        await set(myRef, {
            ...myParticipant,
            score: newScore,
            currentAnswerIndex: optionIndex,
            lastAnswerTime: Date.now()
        });
    };

    if (!quizState) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center justify-center overflow-hidden">

            {/* WAITING ROOM */}
            {quizState.status === "waiting" && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                >
                    <div className="text-6xl mb-6 animate-bounce">⏳</div>
                    <h1 className="text-3xl font-bold mb-4">Waiting for Host...</h1>
                    <p className="text-gray-400">You are in! Get ready.</p>
                    <div className="mt-8 p-4 bg-gray-800 rounded-lg inline-block border border-gray-700">
                        <span className="text-gray-500 text-sm block mb-1">Signed in as</span>
                        <span className="font-bold text-xl text-blue-400">{myParticipant?.name}</span>
                    </div>
                </motion.div>
            )}

            {/* ACTIVE GAME */}
            {quizState.status === "active" && (
                <div className="w-full max-w-2xl">
                    {/* Header info */}
                    <div className="flex justify-between items-center mb-6 text-sm text-gray-500 uppercase font-bold tracking-widest">
                        <span>Q{quizState.currentQuestionIndex + 1} / {questions.length}</span>
                        <span>Score: {myParticipant?.score || 0}</span>
                    </div>

                    <AnimatePresence mode="wait">
                        {/* QUESTION CARD */}
                        {!quizState.showResult && currentQuestion && (
                            <motion.div
                                key="question"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl border border-gray-700"
                            >
                                {currentQuestion.imageUrl && (
                                    <img src={currentQuestion.imageUrl} className="w-full h-48 md:h-64 object-cover rounded-xl mb-6" alt="Question" />
                                )}
                                <h2 className="text-2xl font-bold mb-8 text-center">{currentQuestion.text}</h2>

                                <div className="grid grid-cols-1 gap-4">
                                    {currentQuestion.options.map((opt: string, i: number) => (
                                        <button
                                            key={i}
                                            disabled={isSubmitted}
                                            onClick={() => submitAnswer(i)}
                                            className={twMerge(
                                                "w-full p-4 rounded-xl text-left font-semibold transition-all transform active:scale-[0.98]",
                                                isSubmitted
                                                    ? (i === selectedOption
                                                        ? "bg-blue-600 ring-2 ring-blue-400 text-white"
                                                        : "bg-gray-700 text-gray-400 opacity-50")
                                                    : "bg-gray-700 hover:bg-gray-600 text-white hover:shadow-lg hover:ring-2 hover:ring-blue-500/20"
                                            )}
                                        >
                                            <span className="mr-4 opacity-50 text-sm">
                                                {String.fromCharCode(65 + i)}
                                            </span>
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* LEADERBOARD / RESULT CARD */}
                        {quizState.showResult && (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 text-center"
                            >
                                <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                                    Leaderboard
                                </h2>
                                <div className="space-y-4">
                                    {leaderboard.map((p: any, i: number) => (
                                        <div
                                            key={i}
                                            className={`flex justify-between items-center p-4 rounded-xl ${p.name === myParticipant?.name ? "bg-blue-900/30 border border-blue-500/50" : "bg-gray-700/50"
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${i === 0 ? "bg-yellow-500 text-black" :
                                                    i === 1 ? "bg-gray-400 text-black" :
                                                        i === 2 ? "bg-orange-700 text-white" : "bg-gray-700 text-gray-400"
                                                    }`}>
                                                    {i + 1}
                                                </span>
                                                <span className="font-semibold">{p.name}</span>
                                            </div>
                                            <span className="font-mono text-xl text-blue-400">{p.score}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-8 text-gray-400 animate-pulse">Waiting for host...</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* GAME OVER */}
            {quizState.status === "finished" && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center max-w-md w-full"
                >
                    <div className="text-6xl mb-6">🎉</div>
                    <h1 className="text-4xl font-bold mb-2">Game Over!</h1>
                    <p className="text-gray-400 mb-8">Thanks for playing.</p>

                    <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 mb-8">
                        <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">Your Score</p>
                        <p className="text-6xl font-black text-blue-500">{myParticipant?.score}</p>
                    </div>

                    <button
                        onClick={() => router.push("/")}
                        className="w-full py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold transition-colors"
                    >
                        Play Again
                    </button>
                </motion.div>
            )}

        </div>
    );
}
