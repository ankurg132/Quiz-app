
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { database, storage } from "@/lib/firebase";
import { ref as dbRef, push, set, get } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { motion, Reorder } from "framer-motion";
import { v4 as uuidv4 } from "uuid";

interface Question {
    id: string;
    text: string;
    imageUrl: string;
    options: string[];
    correctIndex: number;
    timeLimit: number;
}

export default function CreateQuiz() {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [saving, setSaving] = useState(false);

    const addQuestion = () => {
        setQuestions([
            ...questions,
            {
                id: uuidv4(),
                text: "",
                imageUrl: "",
                options: ["", "", "", ""],
                correctIndex: 0,
                timeLimit: 30,
            },
        ]);
    };

    const updateQuestion = (index: number, field: string, value: any) => {
        const newQuestions = [...questions];
        (newQuestions[index] as any)[field] = value;
        setQuestions(newQuestions);
    };

    const updateOption = (qIndex: number, oIndex: number, value: string) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options[oIndex] = value;
        setQuestions(newQuestions);
    };

    const handleImageUpload = async (index: number, file: File) => {
        if (!file) return;
        const toastId = `upload-${index}`; // In real app use toast
        try {
            const fileRef = storageRef(storage, `quiz-images/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            updateQuestion(index, "imageUrl", url);
        } catch (error) {
            console.error("Upload failed", error);
            alert("Image upload failed");
        }
    };

    const removeQuestion = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const generatePin = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    const saveQuiz = async () => {
        if (!title) return alert("Please enter a title");
        if (questions.length === 0) return alert("Add at least one question");

        setSaving(true);
        try {
            let pin = generatePin();
            let isUnique = false;

            // Allow a few retries for uniqueness
            for (let i = 0; i < 5; i++) {
                const snapshot = await get(dbRef(database, `quizzes/${pin}`));
                if (!snapshot.exists()) {
                    isUnique = true;
                    break;
                }
                pin = generatePin();
            }

            if (!isUnique) {
                throw new Error("Failed to generate a unique PIN. Please try again.");
            }

            await set(dbRef(database, `quizzes/${pin}`), {
                info: {
                    title,
                    createdAt: Date.now(),
                    createdBy: "tfugadmin",
                },
                questions,
                state: {
                    status: "waiting", // active, finished
                    currentQuestionIndex: -1,
                    showResult: false,
                },
            });
            router.push("/admin/dashboard");
        } catch (error) {
            console.error("Save failed", error);
            alert("Failed to save quiz");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight">Create New Quiz</h1>
                    <button
                        onClick={saveQuiz}
                        disabled={saving}
                        className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold shadow-lg shadow-green-900/20 disabled:opacity-50 transition-all hover:scale-105"
                    >
                        {saving ? "Saving..." : "Save Quiz"}
                    </button>
                </div>

                <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-xl">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-neutral-500">
                        Quiz Title
                    </label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 focus:border-orange-500 outline-none transition-colors text-lg placeholder:text-neutral-600"
                        placeholder="e.g. Flutter Basics Trivia"
                    />
                </div>

                <div className="space-y-6">
                    {questions.map((q, qIndex) => (
                        <motion.div
                            key={q.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 relative shadow-lg"
                        >
                            <button
                                onClick={() => removeQuestion(qIndex)}
                                className="absolute top-4 right-4 text-neutral-600 hover:text-red-400 transition-colors p-2"
                            >
                                ✕
                            </button>

                            <h3 className="text-lg font-bold mb-4 text-orange-400">
                                Question {qIndex + 1}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                <div>
                                    <label className="block text-xs uppercase text-neutral-500 font-bold mb-2">
                                        Question Text
                                    </label>
                                    <input
                                        value={q.text}
                                        onChange={(e) => updateQuestion(qIndex, "text", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 focus:border-orange-500 outline-none transition-colors"
                                        placeholder="Enter question..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-neutral-500 font-bold mb-2">
                                        Image (Optional)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) =>
                                                e.target.files?.[0] && handleImageUpload(qIndex, e.target.files[0])
                                            }
                                            className="text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-500 cursor-pointer"
                                        />
                                    </div>
                                    {q.imageUrl && (
                                        <img
                                            src={q.imageUrl}
                                            alt="Preview"
                                            className="mt-2 h-20 w-auto rounded-lg border border-neutral-700 object-cover"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                {q.options.map((opt, oIndex) => (
                                    <div key={oIndex} className="relative">
                                        <input
                                            value={opt}
                                            onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                            className={`w-full px-3 py-2 pl-10 rounded-lg bg-neutral-800 border ${q.correctIndex === oIndex
                                                ? "border-green-500 ring-1 ring-green-500 bg-green-900/10"
                                                : "border-neutral-700"
                                                } focus:border-orange-500 outline-none transition-colors`}
                                            placeholder={`Option ${oIndex + 1}`}
                                        />
                                        <button
                                            onClick={() => updateQuestion(qIndex, "correctIndex", oIndex)}
                                            className={`absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border flex items-center justify-center transition-all ${q.correctIndex === oIndex
                                                ? "bg-green-500 border-green-500 scale-110"
                                                : "border-neutral-600 hover:border-neutral-400"
                                                }`}
                                        >
                                            {q.correctIndex === oIndex && <span className="text-white text-xs font-bold">✓</span>}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="text-sm text-neutral-400 font-medium">Time Limit (s):</label>
                                <input
                                    type="number"
                                    value={q.timeLimit}
                                    onChange={(e) =>
                                        updateQuestion(qIndex, "timeLimit", parseInt(e.target.value) || 0)
                                    }
                                    className="w-20 px-3 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-center focus:border-orange-500 outline-none"
                                />
                            </div>
                        </motion.div>
                    ))}
                </div>

                <button
                    onClick={addQuestion}
                    className="w-full py-4 rounded-xl border-2 border-dashed border-neutral-800 text-neutral-500 hover:border-orange-500 hover:text-orange-500 transition-colors font-bold uppercase tracking-wider text-sm"
                >
                    + Add Question
                </button>
            </div>
        </div>
    );
}
