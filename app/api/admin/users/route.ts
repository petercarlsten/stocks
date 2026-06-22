import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllUsers, deleteUser, isAdmin } from "@/lib/users";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name ?? null;
  if (!username || !isAdmin(username)) return null;
  return username;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const users = getAllUsers().map((u) => ({
    username: u.username,
    provider: u.provider ?? "credentials",
    createdAt: u.createdAt ?? null,
    lastLoginAt: u.lastLoginAt ?? null,
    lastSeenAt: u.lastSeenAt ?? null,
    lastSeenDevice: u.lastSeenDevice ?? null,
    loginCount: u.loginCount ?? 0,
    theme: u.preferences?.theme ?? null,
    funnyMode: u.preferences?.funnyMode ?? null,
  }));
  return NextResponse.json({ users });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { username } = await req.json();
  if (!username || username.toLowerCase() === admin.toLowerCase()) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }
  deleteUser(username);
  return NextResponse.json({ ok: true });
}
