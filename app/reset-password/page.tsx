"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setErrorMsg("Passwords do not match"); setStatus("error"); return; }
    setStatus("loading");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const json = await res.json();
    if (!res.ok) { setErrorMsg(json.error ?? "Failed to reset password"); setStatus("error"); return; }
    router.push("/login?reset=1");
  }

  if (!token) {
    return <p className="text-red-500 text-sm">Invalid reset link.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">New password</label>
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
      {status === "error" && <p className="text-red-500 text-sm">{errorMsg}</p>}
      <button
        type="submit"
        disabled={status === "loading"}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-5 py-2 font-medium text-white transition-colors"
      >
        {status === "loading" ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-gray-900 font-semibold text-lg mb-5">Set new password</h2>
          <Suspense fallback={<p className="text-gray-500 text-sm">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
          <p className="text-gray-500 text-sm mt-4 text-center">
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700">Back to sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
