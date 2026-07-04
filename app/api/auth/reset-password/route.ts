import { NextRequest, NextResponse } from "next/server";
import { findByResetToken, clearResetToken, updatePassword } from "@/lib/users";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const user = findByResetToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  await updatePassword(user.username, password);
  clearResetToken(user.username);

  return NextResponse.json({ ok: true });
}
