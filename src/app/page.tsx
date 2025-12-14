
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { database } from "@/lib/firebase";
import { ref, get, set } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Gamepad2, Sparkles, Loader2, Trophy } from "lucide-react";

const BackgroundGradient = () => {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-950">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] animate-pulse delay-1000" />
            <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[150px]" />
        </div>
    );
};

export default function Home() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [quizId, setQuizId] = useState("");
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !quizId) {
            setError("Please fill in all fields");
            return;
        }

        setJoining(true);
        setError("");

        try {
            // internal override for quick admin access
            if (name === "tfugadmin" && quizId === "admin") {
                router.push("/admin");
                return;
            }

            // Check if quiz exists
            const quizRef = ref(database, `quizzes/${quizId}`);
            const snapshot = await get(quizRef);

            if (!snapshot.exists()) {
                setError("Quiz not found");
                setJoining(false);
                return;
            }

            // Generate session ID if not exists
            let userId = localStorage.getItem("quizUserId");
            if (!userId) {
                userId = uuidv4();
                localStorage.setItem("quizUserId", userId);
            }
            localStorage.setItem("quizUserName", name);

            // Register participant
            await set(ref(database, `quizzes/${quizId}/participants/${userId}`), {
                name,
                score: 0,
                currentAnswerIndex: -1,
                lastAnswerTime: Date.now(),
            });

            router.push(`/play/${quizId}`);
        } catch (err) {
            console.error(err);
            setError("Failed to join. Try again.");
            setJoining(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative text-white font-sans selection:bg-blue-500/30 bg-neutral-950">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-lg relative z-10"
            >
                <div className="text-center mb-12 space-y-4">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-blue-900/20 mb-6 group hover:rotate-3 transition-transform"
                    >
                        <Gamepad2 className="w-10 h-10 text-white group-hover:scale-110 transition-transform" />
                    </motion.div>

                    <h1 className="text-6xl font-black tracking-tighter text-white drop-shadow-sm">
                        QuizLive
                    </h1>
                    <p className="text-lg text-neutral-400 font-medium tracking-wide">
                        Real-time multiplayer knowledge battles
                    </p>
                </div>

                <Card className="bg-neutral-900 border-neutral-800 shadow-2xl ring-1 ring-white/5">
                    <CardHeader className="space-y-1 pt-8 pb-4 text-center">
                        <CardTitle className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
                            <Sparkles className="w-5 h-5 text-yellow-500" />
                            Join the Action
                        </CardTitle>
                        <CardDescription className="text-neutral-400 text-base">
                            Enter your credentials to enter the arena
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-4">
                        <form onSubmit={handleJoin} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-neutral-500 text-xs font-bold uppercase tracking-wider ml-1">
                                    Display Name
                                </Label>
                                <div className="relative group">
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-14 bg-neutral-800 border-neutral-700 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20 text-lg px-4 transition-all group-hover:border-neutral-600 text-white placeholder:text-neutral-600"
                                        placeholder="e.g. Maverick"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="quizId" className="text-neutral-500 text-xs font-bold uppercase tracking-wider ml-1">
                                    Game Pin
                                </Label>
                                <div className="relative group">
                                    <Input
                                        id="quizId"
                                        value={quizId}
                                        onChange={(e) => setQuizId(e.target.value)}
                                        className="h-14 bg-neutral-800 border-neutral-700 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20 text-lg px-4 transition-all group-hover:border-neutral-600 text-white placeholder:text-neutral-600 font-mono tracking-wider"
                                        placeholder="000 000"
                                    />
                                    <Trophy className="absolute right-4 top-4 w-6 h-6 text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                            </div>

                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="text-red-400 text-sm font-medium bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20 text-center"
                                    >
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <Button
                                type="submit"
                                disabled={joining}
                                className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20 transition-all outline-none ring-0 border-0 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:hover:scale-100"
                            >
                                {joining ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    "Enter Game"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <p className="text-center mt-12 text-neutral-500 text-sm font-medium">
                    Want to create your own quiz?{" "}
                    <a href="/admin" className="text-neutral-400 hover:text-white underline underline-offset-4 transition-colors">
                        Host Dashboard
                    </a>
                </p>
            </motion.div>
        </div>
    );
}
