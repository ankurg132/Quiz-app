
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function AdminLogin() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === "tfugadmin") {
            // In a real app, set a cookie or token. Here, just redirect.
            // We'll trust the user isn't bypassing client-side routing for this MVP.
            localStorage.setItem("adminAuth", "true");
            router.push("/admin/dashboard");
        } else {
            setError("Invalid password");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-white font-sans">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-neutral-900 p-8 rounded-2xl shadow-xl w-full max-w-md border border-neutral-800"
            >
                <h1 className="text-3xl font-bold mb-6 text-center text-white">
                    Admin Login
                </h1>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-neutral-500 ml-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-neutral-800 border-neutral-700 text-white focus:border-orange-500 focus:outline-none transition-colors placeholder:text-neutral-600"
                            placeholder="Enter admin password"
                        />
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <button
                        type="submit"
                        className="w-full py-3 rounded-lg bg-orange-600 font-bold hover:bg-orange-700 transition-all transform hover:scale-[1.02] text-white shadow-lg shadow-orange-900/20"
                    >
                        Access Dashboard
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
