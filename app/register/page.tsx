"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const turnstileToken = useRef<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (!turnstileToken.current) { setError("Please complete the human check"); return; }
    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, turnstileToken: turnstileToken.current }),
    });
    const json = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(json.error ?? "Registration failed");
      return;
    }
    await signIn("credentials", { username, password, redirect: false });
    router.push("/");
    router.refresh();
  }

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 p-4 rounded-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none"/>
            <svg width="56" height="38" viewBox="0 0 64 42" fill="none">
              <defs>
                <linearGradient id="regAreaGrad" x1="0" y1="0" x2="0" y2="42" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="white" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="white" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <line x1="0" y1="14" x2="64" y2="14" stroke="white" strokeWidth="0.5" opacity="0.12"/>
              <line x1="0" y1="28" x2="64" y2="28" stroke="white" strokeWidth="0.5" opacity="0.12"/>
              <path d="M 2,40 C 10,38 14,30 20,26 C 26,22 30,28 36,18 C 44,8 52,5 62,3 L 62,42 Z" fill="url(#regAreaGrad)"/>
              <path d="M 2,40 C 10,38 14,30 20,26 C 26,22 30,28 36,18 C 44,8 52,5 62,3" stroke="white" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.08"/>
              <path d="M 2,40 C 10,38 14,30 20,26 C 26,22 30,28 36,18 C 44,8 52,5 62,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <circle cx="20" cy="26" r="2.5" fill="white" opacity="0.9"/>
              <circle cx="36" cy="18" r="2.5" fill="white" opacity="0.9"/>
              <circle cx="52" cy="5" r="2.5" fill="white" opacity="0.9"/>
              <circle cx="62" cy="3" r="5" fill="white"/>
              <circle cx="62" cy="3" r="9" fill="white" opacity="0.2"/>
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 bg-clip-text text-transparent">
            My Portfolio
          </h1>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-800">
          <p className="font-semibold mb-1">Work in progress</p>
          <p>This tool is provided as-is for personal use. Data shown (prices, valuations, gains) may be inaccurate. The creator takes no liability for any decisions made based on information displayed here.</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-gray-900 font-semibold text-lg mb-5">Create account</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Username</label>
              <input
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                minLength={3}
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
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Confirm password</label>
              <input
                type="password"
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Turnstile
              siteKey={siteKey}
              onSuccess={(token) => { turnstileToken.current = token; }}
              onExpire={() => { turnstileToken.current = null; }}
              options={{ theme: "light" }}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-5 py-2 font-medium text-white transition-colors mt-1"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="text-gray-500 text-sm mt-4 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
