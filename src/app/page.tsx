
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

const BackgroundPattern = () => (
    <div className="fixed inset-0 -z-10 bg-neutral-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(251,146,60,0.15),rgba(255,255,255,0))]">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
    </div>
);

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
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative text-white font-sans selection:bg-orange-500/30 overflow-hidden">
            <BackgroundPattern />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md z-10"
            >
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
                        className="inline-flex items-center justify-center p-4 rounded-3xl bg-orange-500/10 border border-orange-500/20 mb-6 shadow-[0_0_30px_rgba(249,115,22,0.2)]"
                    >
                        <Gamepad2 className="w-10 h-10 text-orange-500" />
                    </motion.div>
                    <h1 className="text-5xl font-black tracking-tighter text-white mb-2">
                        ML Bhopal <span className="text-orange-500">Quiz</span>
                    </h1>
                    <p className="text-neutral-400 font-medium">Enter the arena and compete.</p>
                </div>

                <Card className="bg-neutral-900/80 backdrop-blur-md border-neutral-800 shadow-2xl ring-1 ring-white/10 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600" />
                    <CardHeader className="space-y-1 text-center pb-2">
                        <CardTitle className="text-xl font-bold tracking-tight text-white">
                            Player Login
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8 pt-4">
                        <form onSubmit={handleJoin} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-neutral-300 font-bold ml-1 text-xs uppercase tracking-wider">
                                    Display Name
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-12 bg-neutral-950/50 border-neutral-800 focus:border-orange-500 focus:ring-orange-500/20 text-white placeholder:text-neutral-600 transition-all font-medium"
                                        placeholder="e.g. Maverick"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="quizId" className="text-neutral-300 font-bold ml-1 text-xs uppercase tracking-wider">
                                    Game PIN
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="quizId"
                                        value={quizId}
                                        onChange={(e) => setQuizId(e.target.value)}
                                        className="h-12 bg-neutral-950/50 border-neutral-800 focus:border-orange-500 focus:ring-orange-500/20 text-white placeholder:text-neutral-600 font-mono tracking-wider text-xl transition-all text-center"
                                        placeholder="000 000"
                                        maxLength={6}
                                    />
                                </div>
                            </div>

                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="text-red-400 text-sm font-medium bg-red-500/10 px-4 py-3 rounded-lg border border-red-500/20 text-center"
                                    >
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <Button
                                type="submit"
                                disabled={joining}
                                className="w-full h-12 text-lg font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {joining ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Joining...
                                    </>
                                ) : (
                                    "Enter Game"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <p className="text-center mt-8 text-neutral-600 text-xs">
                    Host your own quiz? <a href="/admin" className="text-orange-500 hover:text-orange-400 underline decoration-orange-500/30 underline-offset-4 transition-colors">Admin Dashboard</a>
                </p>
            </motion.div>
        </div>
    );
}
