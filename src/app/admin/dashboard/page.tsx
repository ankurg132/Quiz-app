
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
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-12">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Admin Dashboard
                    </h1>
                    <Link
                        href="/admin/create"
                        className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors font-semibold shadow-lg shadow-blue-500/20"
                    >
                        + Create New Quiz
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center text-gray-500 animate-pulse">Loading quizzes...</div>
                ) : quizzes.length === 0 ? (
                    <div className="text-center py-20 bg-gray-800/50 rounded-2xl border border-gray-700">
                        <p className="text-xl text-gray-400">No quizzes found.</p>
                        <p className="text-gray-500 mt-2">Create your first quiz to get started!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {quizzes.map((quiz, index) => (
                            <motion.div
                                key={quiz.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-colors group relative"
                            >
                                <button
                                    onClick={(e) => deleteQuiz(e, quiz.id)}
                                    className="absolute top-4 right-4 text-gray-500 hover:text-red-500 transition-colors p-2 z-10"
                                    title="Delete Quiz"
                                >
                                    ✕
                                </button>

                                <h2 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors pr-8">
                                    {quiz.info?.title || "Untitled Quiz"}
                                </h2>
                                <div className="mb-4">
                                    <span className="text-xs uppercase tracking-wider text-gray-400 font-bold mr-2">Pin:</span>
                                    <span className="font-mono text-blue-400 bg-blue-900/30 px-2 py-1 rounded text-sm select-all">
                                        {quiz.id}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 mb-4">
                                    {new Date(quiz.info?.createdAt || Date.now()).toLocaleDateString()}
                                </p>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm bg-gray-700 px-3 py-1 rounded-full text-gray-300">
                                        {quiz.questions?.length || 0} Questions
                                    </span>
                                    <Link
                                        href={`/admin/quiz/${quiz.id}`}
                                        className="text-blue-400 hover:text-blue-300 text-sm font-semibold"
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
