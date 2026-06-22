"use client";
import { useEffect, useRef, useState } from "react";

interface UserInfo {
  username: string;
  provider: "google" | "credentials";
  createdAt: string | null;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  lastSeenDevice: string | null;
  loginCount: number;
  theme: "light" | "dark" | null;
  funnyMode: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminPanel({ open, onClose }: Props) {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []));
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  async function handleDelete(username: string) {
    setDeleting(username);
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    setUsers((prev) => prev.filter((u) => u.username !== username));
    setDeleting(null);
    setConfirm(null);
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" />
      <div
        ref={panelRef}
        className="fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50 flex flex-col shadow-xl w-full sm:w-auto"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="font-bold text-sm">Admin — Accounts ({users.length})</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left text-gray-500">
                <th className="px-2 py-1.5 font-semibold border-b border-gray-200">User</th>
                <th className="px-2 py-1.5 font-semibold border-b border-gray-200">Auth</th>
                <th className="px-2 py-1.5 font-semibold border-b border-gray-200">Joined</th>
                <th className="px-2 py-1.5 font-semibold border-b border-gray-200">Last seen</th>
                <th className="px-2 py-1.5 font-semibold border-b border-gray-200">Device</th>
                <th className="px-2 py-1.5 font-semibold border-b border-gray-200">Theme</th>
                <th className="px-2 py-1.5 font-semibold border-b border-gray-200">Funny</th>
                <th className="px-2 py-1.5 font-semibold border-b border-gray-200 text-right">Logins</th>
                <th className="px-2 py-1.5 border-b border-gray-200"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">{u.username}</td>
                  <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{u.provider === "google" ? "Google" : "Password"}</td>
                  <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                  <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{fmtDateTime(u.lastSeenAt)}</td>
                  <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{u.lastSeenDevice ?? "—"}</td>
                  <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{u.theme ?? "—"}</td>
                  <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{u.funnyMode ?? "—"}</td>
                  <td className="px-2 py-1.5 text-gray-500 text-right">{u.loginCount}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {confirm === u.username ? (
                      <span className="flex items-center gap-1">
                        <button onClick={() => handleDelete(u.username)} disabled={deleting === u.username}
                          className="text-white bg-red-500 hover:bg-red-600 px-1.5 py-0.5 rounded">
                          {deleting === u.username ? "…" : "Confirm"}
                        </button>
                        <button onClick={() => setConfirm(null)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirm(u.username)} className="text-red-400 hover:text-red-600">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
