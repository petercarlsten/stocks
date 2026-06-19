import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findByUsername, verifyPassword } from "@/lib/users";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name ?? null;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const user = findByUsername(username);
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Password change not available for this account" }, { status: 400 });
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });

  const newHash = await bcrypt.hash(newPassword, 12);
  const FILE = path.join(process.cwd(), "data", "users.json");
  const users = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  const idx = users.findIndex((u: { username: string }) => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return NextResponse.json({ error: "User not found" }, { status: 404 });
  users[idx].passwordHash = newHash;
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));

  return NextResponse.json({ ok: true });
}
