"use client";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminPanel({ open, onClose }: Props) {
  const [users, setUsers] = useState<string[]>([]);
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
    setUsers((prev) => prev.filter((u) => u !== username));
    setDeleting(null);
    setConfirm(null);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Admin — Accounts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-700 dark:text-gray-300">{u}</span>
              {confirm === u ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={deleting === u}
                    className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded"
                  >
                    {deleting === u ? "Deleting…" : "Confirm"}
                  </button>
                  <button onClick={() => setConfirm(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirm(u)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
