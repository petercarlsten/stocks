"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "noEmail" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const json = await res.json();
    if (!res.ok) { setStatus("error"); return; }
    setStatus(json.noEmail ? "noEmail" : "sent");
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-gray-900 font-semibold text-lg mb-2">Forgot password</h2>

          {status === "sent" && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
              Check your email for a reset link. It expires in 1 hour.
            </div>
          )}

          {status === "noEmail" && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
              No email address is set for this account. Contact the admin to reset your password.
            </div>
          )}

          {status === "error" && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              Something went wrong. Please try again.
            </div>
          )}

          {status !== "sent" && (
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
              <button
                type="submit"
                disabled={status === "loading"}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-5 py-2 font-medium text-white transition-colors"
              >
                {status === "loading" ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

          <p className="text-gray-500 text-sm mt-4 text-center">
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700">Back to sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
