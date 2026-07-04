"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
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
      body: JSON.stringify({ username, email, password, turnstileToken: turnstileToken.current }),
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
            <svg width="60" height="46" viewBox="0 0 100 66" fill="none">
              <path d="M 10,30 C 4,18 4,8 8,2" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none"/>
              <circle cx="8" cy="1" r="4.5" fill="white"/>
              <ellipse cx="44" cy="44" rx="34" ry="20" fill="white"/>
              <ellipse cx="66" cy="26" rx="18" ry="13" fill="white"/>
              <ellipse cx="82" cy="48" rx="14" ry="10" transform="rotate(-18 82 48)" fill="white"/>
              <ellipse cx="90" cy="54" rx="8" ry="6" fill="white"/>
              <path d="M 84,38 C 90,28 96,20 94,12" stroke="white" strokeWidth="5.5" strokeLinecap="round" fill="none"/>
              <path d="M 76,34 C 80,24 86,16 84,8" stroke="white" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
              <path d="M 72,60 C 76,63 80,66 84,66" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none"/>
              <path d="M 80,62 C 83,64 86,66 88,64" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none"/>
              <path d="M 26,60 C 22,63 18,66 14,66" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none"/>
              <path d="M 36,62 C 32,64 28,66 25,65" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none"/>
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
              <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Email</label>
              <input
                type="email"
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="Used for password recovery"
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
