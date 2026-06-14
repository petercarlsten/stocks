"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid username or password");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent mb-8 text-center">
          Stock Charts
        </h1>
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-gray-900 font-semibold text-lg mb-5">Sign in</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Username</label>
              <input
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Password</label>
              <input
                type="password"
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-5 py-2 font-medium text-white transition-colors mt-1"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="text-gray-500 text-sm mt-4 text-center">
            No account?{" "}
            <Link href="/register" className="text-indigo-600 hover:text-indigo-700">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
