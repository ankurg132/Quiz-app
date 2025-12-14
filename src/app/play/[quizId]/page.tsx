
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

    const [timeLeft, setTimeLeft] = useState<number>(0);

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

        // Listen to all participants for leaderboard
        const allParticipantsRef = ref(database, `quizzes/${quizId}/participants`);
        const unsubAll = onValue(allParticipantsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.values(data).sort((a: any, b: any) => {
                    if (b.score !== a.score) {
                        return b.score - a.score;
                    }
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
            const index = quizState.currentQuestionIndex;
            setCurrentQuestion(questions[index]);

            // Reset Timer
            if (questions[index].timeLimit) {
                setTimeLeft(questions[index].timeLimit);
            }
        }
    }, [quizState?.currentQuestionIndex, questions]);

    // Timer Countdown
    useEffect(() => {
        if (quizState?.status === "active" && !quizState.showResult && timeLeft > 0) {
            const timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [quizState?.status, quizState?.showResult, timeLeft]);


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
        const points = isCorrect ? 10 : 0;

        const myRef = ref(database, `quizzes/${quizId}/participants/${userId}`);
        const newScore = (myParticipant?.score || 0) + points;

        await set(myRef, {
            ...myParticipant,
            score: newScore,
            currentAnswerIndex: optionIndex,
            lastAnswerTime: Date.now()
        });
    };

    if (!quizState) return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center font-sans">Loading...</div>;

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-4 flex flex-col items-center justify-center font-sans theme-premium">
            {/* WAITING ROOM */}
            {quizState.status === "waiting" && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center max-w-md w-full bg-neutral-900 p-8 rounded-2xl border border-neutral-800 shadow-2xl"
                >
                    <div className="text-6xl mb-6 animate-pulse">⏳</div>
                    <h1 className="text-3xl font-bold mb-4 text-white tracking-tight">Waiting for Host</h1>
                    <p className="text-neutral-400 mb-8">The game will start shortly. Get ready!</p>

                    <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-700">
                        <span className="text-neutral-500 text-xs font-bold uppercase tracking-wider block mb-1">You Joined As</span>
                        <span className="font-bold text-xl text-blue-400">{myParticipant?.name}</span>
                    </div>
                </motion.div>
            )}

            {/* ACTIVE GAME */}
            {quizState.status === "active" && (
                <div className="w-full max-w-2xl">
                    {/* Header info */}
                    <div className="flex justify-between items-end mb-6 text-sm font-bold tracking-widest text-neutral-500">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase">Question</span>
                            <span className="text-white text-xl">{quizState.currentQuestionIndex + 1} <span className="text-neutral-600">/ {questions.length}</span></span>
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                            <span className="text-xs uppercase">Your Score</span>
                            <span className="text-blue-400 text-xl">{myParticipant?.score || 0}</span>
                        </div>
                    </div>

                    {/* Timer Bar */}
                    {!quizState.showResult && (
                        <div className="w-full h-2 bg-neutral-800 rounded-full mb-8 overflow-hidden">
                            <motion.div
                                className="h-full bg-blue-500"
                                initial={{ width: "100%" }}
                                animate={{ width: `${(timeLeft / (currentQuestion?.timeLimit || 20)) * 100}%` }}
                                transition={{ ease: "linear", duration: 1 }}
                            />
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {/* QUESTION CARD */}
                        {!quizState.showResult && currentQuestion && (
                            <motion.div
                                key="question"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="bg-neutral-900 p-6 md:p-8 rounded-3xl shadow-2xl border border-neutral-800"
                            >
                                {currentQuestion.imageUrl && (
                                    <div className="relative w-full h-56 mb-8 rounded-2xl overflow-hidden border border-neutral-800">
                                        <img src={currentQuestion.imageUrl} className="w-full h-full object-cover" alt="Question" />
                                    </div>
                                )}

                                <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center leading-tight text-white">{currentQuestion.text}</h2>

                                <div className="grid grid-cols-1 gap-4">
                                    {currentQuestion.options.map((opt: string, i: number) => (
                                        <button
                                            key={i}
                                            disabled={isSubmitted}
                                            onClick={() => submitAnswer(i)}
                                            className={twMerge(
                                                "w-full p-5 rounded-xl text-left font-medium transition-all transform active:scale-[0.98] flex items-center group",
                                                isSubmitted
                                                    ? (i === selectedOption
                                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                                                        : "bg-neutral-800 text-neutral-500 opacity-50")
                                                    : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white"
                                            )}
                                        >
                                            <div className={twMerge(
                                                "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold mr-4 transition-colors",
                                                isSubmitted && i === selectedOption ? "bg-white/20 text-white" : "bg-neutral-700 text-neutral-400 group-hover:bg-neutral-600 group-hover:text-white"
                                            )}>
                                                {String.fromCharCode(65 + i)}
                                            </div>
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
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-neutral-900 p-8 rounded-3xl shadow-2xl border border-neutral-800"
                            >
                                <div className="text-center mb-8">
                                    <h2 className="text-3xl font-bold mb-8 text-white">
                                        Leaderboard
                                    </h2>
                                    <p className="text-neutral-500">Top 5 Players</p>
                                </div>

                                <div className="space-y-3">
                                    {leaderboard.map((p: any, i: number) => (
                                        <div
                                            key={i}
                                            className={twMerge(
                                                "flex justify-between items-center p-4 rounded-xl border transition-all",
                                                p.name === myParticipant?.name
                                                    ? "bg-blue-600/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                                                    : "bg-neutral-800/50 border-neutral-800"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={twMerge(
                                                    "w-10 h-10 flex items-center justify-center rounded-lg font-bold text-lg",
                                                    i === 0 ? "bg-yellow-500 text-yellow-950" :
                                                        i === 1 ? "bg-neutral-400 text-neutral-900" :
                                                            i === 2 ? "bg-orange-700 text-orange-100" : "bg-neutral-800 text-neutral-500"
                                                )}>
                                                    #{i + 1}
                                                </div>
                                                <span className={clsx("font-semibold text-lg", p.name === myParticipant?.name ? "text-blue-400" : "text-neutral-200")}>{p.name}</span>
                                            </div>
                                            <span className="font-mono text-xl font-bold text-neutral-400">{p.score}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 flex items-center justify-center gap-2 text-neutral-500 text-sm animate-pulse">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    Next question starting soon...
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* GAME OVER */}
            {quizState.status === "finished" && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center max-w-2xl w-full"
                >
                    <div className="text-6xl mb-6">🏆</div>
                    <h1 className="text-4xl font-bold mb-4 text-white">Game Over!</h1>
                    <p className="text-neutral-400 mb-8">Thank you for playing.</p>

                    <div className="bg-neutral-900 p-8 rounded-3xl border border-neutral-800 mb-8 shadow-xl">
                        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2 font-bold">Your Final Score</p>
                        <p className="text-7xl font-black text-blue-500 tracking-tighter">{myParticipant?.score}</p>
                    </div>

                    {/* Final Leaderboard */}
                    <div className="bg-neutral-900 p-8 rounded-3xl border border-neutral-800 mb-8 text-left shadow-xl">
                        <h2 className="text-2xl font-bold mb-6 text-white text-center">
                            Final Leaderboard
                        </h2>
                        <div className="space-y-3">
                            {leaderboard.map((p: any, i: number) => (
                                <div
                                    key={i}
                                    className={twMerge(
                                        "flex justify-between items-center p-4 rounded-xl border transition-all",
                                        p.name === myParticipant?.name
                                            ? "bg-blue-600/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                                            : "bg-neutral-800/50 border-neutral-800"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={twMerge(
                                            "w-10 h-10 flex items-center justify-center rounded-lg font-bold text-lg",
                                            i === 0 ? "bg-yellow-500 text-yellow-950" :
                                                i === 1 ? "bg-neutral-400 text-neutral-900" :
                                                    i === 2 ? "bg-orange-700 text-orange-100" : "bg-neutral-800 text-neutral-500"
                                        )}>
                                            #{i + 1}
                                        </div>
                                        <span className={clsx("font-semibold text-lg", p.name === myParticipant?.name ? "text-blue-400" : "text-neutral-200")}>{p.name}</span>
                                    </div>
                                    <span className="font-mono text-xl font-bold text-neutral-400">{p.score}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => router.push("/")}
                        className="w-full py-4 bg-white text-neutral-900 hover:bg-neutral-200 rounded-xl font-bold transition-colors text-lg"
                    >
                        Return Home
                    </button>
                </motion.div>
            )}

        </div>
    );
}
