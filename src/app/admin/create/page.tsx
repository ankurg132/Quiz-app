
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
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Create New Quiz</h1>
                    <button
                        onClick={saveQuiz}
                        disabled={saving}
                        className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Quiz"}
                    </button>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <label className="block text-sm font-medium mb-2 text-gray-400">
                        Quiz Title
                    </label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none"
                        placeholder="e.g. Flutter Basics Trivia"
                    />
                </div>

                <div className="space-y-6">
                    {questions.map((q, qIndex) => (
                        <motion.div
                            key={q.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-gray-800 p-6 rounded-xl border border-gray-700 relative"
                        >
                            <button
                                onClick={() => removeQuestion(qIndex)}
                                className="absolute top-4 right-4 text-red-400 hover:text-red-300"
                            >
                                ✕
                            </button>

                            <h3 className="text-lg font-semibold mb-4 text-blue-400">
                                Question {qIndex + 1}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 mb-1">
                                        Question Text
                                    </label>
                                    <input
                                        value={q.text}
                                        onChange={(e) => updateQuestion(qIndex, "text", e.target.value)}
                                        className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none"
                                        placeholder="Enter question..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 mb-1">
                                        Image (Optional)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) =>
                                                e.target.files?.[0] && handleImageUpload(qIndex, e.target.files[0])
                                            }
                                            className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                                        />
                                    </div>
                                    {q.imageUrl && (
                                        <img
                                            src={q.imageUrl}
                                            alt="Preview"
                                            className="mt-2 h-20 w-auto rounded border border-gray-600"
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
                                            className={`w-full px-3 py-2 pl-10 rounded bg-gray-700 border ${q.correctIndex === oIndex
                                                ? "border-green-500 ring-1 ring-green-500"
                                                : "border-gray-600"
                                                } focus:border-blue-500 outline-none`}
                                            placeholder={`Option ${oIndex + 1}`}
                                        />
                                        <button
                                            onClick={() => updateQuestion(qIndex, "correctIndex", oIndex)}
                                            className={`absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border flex items-center justify-center ${q.correctIndex === oIndex
                                                ? "bg-green-500 border-green-500"
                                                : "border-gray-500 hover:border-gray-300"
                                                }`}
                                        >
                                            {q.correctIndex === oIndex && <span className="text-white text-xs">✓</span>}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="text-sm text-gray-400">Time Limit (s):</label>
                                <input
                                    type="number"
                                    value={q.timeLimit}
                                    onChange={(e) =>
                                        updateQuestion(qIndex, "timeLimit", parseInt(e.target.value) || 0)
                                    }
                                    className="w-20 px-3 py-1 rounded bg-gray-700 border border-gray-600 text-center"
                                />
                            </div>
                        </motion.div>
                    ))}
                </div>

                <button
                    onClick={addQuestion}
                    className="w-full py-4 rounded-xl border-2 border-dashed border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors font-semibold"
                >
                    + Add Question
                </button>
            </div>
        </div>
    );
}
