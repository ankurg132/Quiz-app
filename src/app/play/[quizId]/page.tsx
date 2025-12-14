"use client";

import { useEffect, useState, useRef } from "react";
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
    const [participantCount, setParticipantCount] = useState<number>(0);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [answerStats, setAnswerStats] = useState<number[]>([0, 0, 0, 0]);

    const [timeLeft, setTimeLeft] = useState<number>(0);

    // Audio refs
    const audioRef = useRef<{ correct: HTMLAudioElement | null, wrong: HTMLAudioElement | null }>({ correct: null, wrong: null });

    // Init Audio
    useEffect(() => {
        if (typeof window !== "undefined") {
            audioRef.current.correct = new Audio("/sounds/correct.mp3");
            audioRef.current.wrong = new Audio("/sounds/wrong.mp3");
        }
    }, []);

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

        // Listen to all participants for leaderboard AND stats
        const allParticipantsRef = ref(database, `quizzes/${quizId}/participants`);
        const unsubAll = onValue(allParticipantsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.values(data);

                // Calculate Stats
                const stats = [0, 0, 0, 0];
                list.forEach((p: any) => {
                    if (p.currentAnswerIndex >= 0 && p.currentAnswerIndex < 4) {
                        stats[p.currentAnswerIndex]++;
                    }
                });
                setAnswerStats(stats);

                // Sort for Leaderboard
                const sortedList = list.sort((a: any, b: any) => {
                    if (b.score !== a.score) {
                        return b.score - a.score;
                    }
                    return (a.lastAnswerTime || Number.MAX_VALUE) - (b.lastAnswerTime || Number.MAX_VALUE);
                });
                setLeaderboard(sortedList.slice(0, 5)); // Top 5
                setParticipantCount(sortedList.length);
            } else {
                setParticipantCount(0);
                setAnswerStats([0, 0, 0, 0]);
            }
        });

        return () => {
            unsubState();
            unsubMy();
            unsubAll();
        };
    }, [quizId, router]);

    // Audio Logic on Result Show
    useEffect(() => {
        if (quizState?.showResult && currentQuestion) {
            // Determine majority vote
            const maxVotes = Math.max(...answerStats);
            const majorityIndexes = answerStats.map((count, i) => count === maxVotes ? i : -1).filter(i => i !== -1);

            // Check if majority was wrong (if majority includes a wrong answer, or just solely wrong)
            // Logic: If the MOST popular choice was WRONG -> Bad Sound. Else -> Good Sound.
            // If tie between Correct and Wrong, emphasize Good.
            // Simpler: If majority chose Wrong -> Bad.

            const correctIndex = currentQuestion.correctIndex;
            const mostPopularIsWrong = majorityIndexes.some(i => i !== correctIndex) && !majorityIndexes.includes(correctIndex);

            // Play sound with slight delay
            const timer = setTimeout(() => {
                const audio = mostPopularIsWrong ? audioRef.current.wrong : audioRef.current.correct;
                if (audio) {
                    audio.volume = 0.5;
                    audio.play().catch((e: unknown) => console.log("Audio play failed:", e));
                }
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [quizState?.showResult, currentQuestion, answerStats]);

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
            answerQuestionIndex: quizState.currentQuestionIndex,
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
                    className="text-center max-w-md w-full"
                >
                    <div className="bg-neutral-900 p-8 rounded-3xl border border-neutral-800 shadow-2xl space-y-8">
                        <div>
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="text-6xl mb-4 inline-block"
                            >
                                ⏳
                            </motion.div>
                            <h1 className="text-2xl font-bold text-white mb-2">Waiting for Host</h1>
                            <p className="text-neutral-400">Get ready to play!</p>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="bg-neutral-800/50 p-4 rounded-xl border border-neutral-800">
                                <span className="text-xs uppercase text-neutral-500 font-bold tracking-widest">Game PIN</span>
                                <div className="text-4xl font-mono font-black text-orange-500 tracking-wider mt-1">{quizId}</div>
                            </div>

                            <div className="bg-neutral-800/50 p-4 rounded-xl border border-neutral-800 flex items-center justify-between px-6">
                                <span className="text-sm font-bold text-neutral-400">Players Joined</span>
                                <span className="text-2xl font-bold text-white flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    {participantCount}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-orange-900/10 rounded-xl border border-orange-500/20">
                            <span className="text-orange-400 text-xs font-bold uppercase tracking-wider block mb-1">You are</span>
                            <span className="font-bold text-xl text-white">{myParticipant?.name}</span>
                        </div>

                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            whileHover={{ scale: 1.05 }}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl font-bold text-white shadow-lg shadow-orange-900/20 active:shadow-none transition-all"
                            onClick={() => {
                                // Add a little vibration if supported or just visual feedback
                                if (navigator.vibrate) navigator.vibrate(50);
                            }}
                        >
                            🔥 I'm Ready!
                        </motion.button>
                        <p className="text-xs text-neutral-600 font-medium">Click to hype yourself up</p>
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
                            <span className="text-orange-400 text-xl">{myParticipant?.score || 0}</span>
                        </div>
                    </div>

                    {/* Timer Bar */}
                    {!quizState.showResult && (
                        <div className="w-full h-2 bg-neutral-800 rounded-full mb-8 overflow-hidden">
                            <motion.div
                                className="h-full bg-orange-500"
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
                                                        ? "bg-orange-600 text-white shadow-lg shadow-orange-900/40"
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
                                className="bg-neutral-900 p-8 rounded-3xl shadow-2xl border border-neutral-800 max-w-3xl w-full"
                            >
                                {/* STATS CHART */}
                                <div className="mb-8">
                                    <h3 className="text-xl font-bold text-center mb-6 text-white">Answer Distribution</h3>
                                    <div className="flex items-end justify-center gap-2 sm:gap-4 h-48 px-2 sm:px-8">
                                        {answerStats.map((count, i) => {
                                            const isCorrect = i === currentQuestion.correctIndex;
                                            const total = participantCount || 1;
                                            const percent = Math.round((count / total) * 100);
                                            const height = Math.max(percent, 5);

                                            return (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-1 sm:gap-2 max-w-[100px] group">
                                                    <motion.span
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.2 + (i * 0.1) }}
                                                        className="text-sm sm:text-lg font-bold text-white mb-1 group-hover:scale-110 transition-transform"
                                                    >
                                                        {count}
                                                    </motion.span>
                                                    <div className="w-full h-32 sm:h-40 bg-neutral-800/50 rounded-t-xl relative overflow-hidden flex items-end">
                                                        <motion.div
                                                            initial={{ height: 0 }}
                                                            animate={{ height: `${height}%` }}
                                                            transition={{ duration: 0.6, delay: i * 0.1, type: "spring", bounce: 0.2 }}
                                                            className={clsx(
                                                                "w-full absolute bottom-0 left-0 right-0 rounded-t-xl transition-colors",
                                                                isCorrect ? "bg-green-500" : "bg-neutral-700"
                                                            )}
                                                        />
                                                    </div>
                                                    <motion.span
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ delay: 0.3 + (i * 0.1) }}
                                                        className={clsx(
                                                            "w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg font-bold text-xs sm:text-sm shadow-md",
                                                            isCorrect ? "bg-green-500 text-green-950" : "bg-neutral-800 text-neutral-500"
                                                        )}
                                                    >
                                                        {String.fromCharCode(65 + i)}
                                                    </motion.span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="h-px bg-neutral-800 w-full mb-8"></div>

                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold mb-8 text-white">
                                        Leaderboard
                                    </h2>
                                    <p className="text-neutral-500 text-sm">Top 5 Players</p>
                                </div>

                                <div className="space-y-3">
                                    {leaderboard.map((p: any, i: number) => (
                                        <div
                                            key={i}
                                            className={twMerge(
                                                "flex justify-between items-center p-4 rounded-xl border transition-all",
                                                p.name === myParticipant?.name
                                                    ? "bg-orange-600/10 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
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
                                                <span className={clsx("font-semibold text-lg", p.name === myParticipant?.name ? "text-orange-400" : "text-neutral-200")}>{p.name}</span>
                                            </div>
                                            <span className="font-mono text-xl font-bold text-neutral-400">{p.score}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 flex items-center justify-center gap-2 text-neutral-500 text-sm animate-pulse">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
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
                        <p className="text-7xl font-black text-orange-500 tracking-tighter">{myParticipant?.score}</p>
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
                                            ? "bg-orange-600/10 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
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
                                        <span className={clsx("font-semibold text-lg", p.name === myParticipant?.name ? "text-orange-400" : "text-neutral-200")}>{p.name}</span>
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
