
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { database } from "@/lib/firebase";
import { ref, onValue, remove } from "firebase/database";
import { motion } from "framer-motion";

interface Quiz {
    id: string;
    info: {
        title: string;
        createdAt: number;
    };
    questions?: any[];
}

export default function AdminDashboard() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const auth = localStorage.getItem("adminAuth");
        if (!auth) {
            router.push("/admin");
            return;
        }

        const quizzesRef = ref(database, "quizzes");
        const unsubscribe = onValue(
            quizzesRef,
            (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const quizList = Object.entries(data).map(([id, value]: [string, any]) => ({
                        id,
                        ...value,
                    }));
                    setQuizzes(quizList.reverse()); // Show newest first
                } else {
                    setQuizzes([]);
                }
                setLoading(false);
            },
            (error) => {
                console.error("Firebase read error:", error);
                setLoading(false);
                // Ideally set an error state here to show to the user
            }
        );

        return () => unsubscribe();
    }, [router]);

    const deleteQuiz = async (e: React.MouseEvent, quizId: string) => {
        e.preventDefault(); // Prevent link navigation
        e.stopPropagation();

        if (confirm("Are you sure you want to delete this quiz? This action cannot be undone.")) {
            try {
                await remove(ref(database, `quizzes/${quizId}`));
            } catch (error) {
                console.error("Delete failed", error);
                alert("Failed to delete quiz");
            }
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-12">
                    <h1 className="text-4xl font-bold text-white tracking-tight">
                        Admin Dashboard
                    </h1>
                    <Link
                        href="/admin/create"
                        className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-900/20 hover:scale-105"
                    >
                        + Create New Quiz
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center text-neutral-500 animate-pulse">Loading quizzes...</div>
                ) : quizzes.length === 0 ? (
                    <div className="text-center py-20 bg-neutral-900/50 rounded-2xl border border-neutral-800">
                        <p className="text-xl text-neutral-400">No quizzes found.</p>
                        <p className="text-neutral-500 mt-2">Create your first quiz to get started!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {quizzes.map((quiz, index) => (
                            <motion.div
                                key={quiz.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 hover:border-blue-500/50 transition-all group relative shadow-lg shadow-black/20"
                            >
                                <button
                                    onClick={(e) => deleteQuiz(e, quiz.id)}
                                    className="absolute top-4 right-4 text-neutral-600 hover:text-red-500 transition-colors p-2 z-10"
                                    title="Delete Quiz"
                                >
                                    ✕
                                </button>

                                <h2 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors pr-8 text-white">
                                    {quiz.info?.title || "Untitled Quiz"}
                                </h2>
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="text-xs uppercase tracking-wider text-neutral-500 font-bold">Pin:</span>
                                    <span className="font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md text-sm border border-blue-500/20 select-all">
                                        {quiz.id}
                                    </span>
                                </div>
                                <p className="text-sm text-neutral-500 mb-6">
                                    {new Date(quiz.info?.createdAt || Date.now()).toLocaleDateString()}
                                </p>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold bg-neutral-800 px-3 py-1 rounded-full text-neutral-400 border border-neutral-700">
                                        {quiz.questions?.length || 0} Questions
                                    </span>
                                    <Link
                                        href={`/admin/quiz/${quiz.id}`}
                                        className="text-blue-400 hover:text-blue-300 text-sm font-bold group-hover:translate-x-1 transition-transform"
                                    >
                                        Manage →
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
