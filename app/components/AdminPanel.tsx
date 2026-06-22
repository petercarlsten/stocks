"use client";
import { useEffect, useState } from "react";

interface UserInfo {
  username: string;
  provider: "google" | "credentials";
  createdAt: string | null;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  lastSeenDevice: string | null;
  loginCount: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function deviceColor(device: string): string {
  if (device === "iPhone" || device === "Android Phone") return "bg-blue-50 text-blue-700";
  if (device === "iPad" || device === "Android Tablet") return "bg-purple-50 text-purple-700";
  return "bg-gray-100 text-gray-600";
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

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []));
  }, [open]);

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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 pt-12 sm:items-center sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-auto flex flex-col max-h-[85vh] sm:max-h-[90vh]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Admin — Accounts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Mobile card layout */}
          <div className="sm:hidden flex flex-col divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.username} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900 text-sm truncate">{u.username}</span>
                  {u.provider === "google" ? (
                    <span className="shrink-0 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">Google</span>
                  ) : (
                    <span className="shrink-0 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Password</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                  <span>Joined: {fmtDate(u.createdAt)}</span>
                  <span>Logins: {u.loginCount}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                  <span>Last login: {fmtDateTime(u.lastLoginAt)}</span>
                  <span>Last seen: {fmtDateTime(u.lastSeenAt)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  {u.lastSeenDevice ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${deviceColor(u.lastSeenDevice)}`}>
                      {u.lastSeenDevice}
                    </span>
                  ) : <span className="text-gray-400 text-xs">—</span>}
                  {confirm === u.username ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDelete(u.username)} disabled={deleting === u.username}
                        className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded">
                        {deleting === u.username ? "…" : "Confirm"}
                      </button>
                      <button onClick={() => setConfirm(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirm(u.username)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Auth</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last login</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last seen</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Device</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Logins</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.username} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800 font-medium max-w-[160px] truncate">{u.username}</td>
                    <td className="px-4 py-3">
                      {u.provider === "google" ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          <svg width="10" height="10" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                          Google
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Password</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDateTime(u.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDateTime(u.lastSeenAt)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {u.lastSeenDevice ? (
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${deviceColor(u.lastSeenDevice)}`}>
                          {u.lastSeenDevice}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs text-right">{u.loginCount}</td>
                    <td className="px-4 py-3 text-right">
                      {confirm === u.username ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleDelete(u.username)} disabled={deleting === u.username}
                            className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded">
                            {deleting === u.username ? "…" : "Confirm"}
                          </button>
                          <button onClick={() => setConfirm(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirm(u.username)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
