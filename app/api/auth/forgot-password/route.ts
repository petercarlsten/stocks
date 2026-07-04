import { NextRequest, NextResponse } from "next/server";
import { findByUsername, setResetToken } from "@/lib/users";
import { sendPasswordReset } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { username } = await req.json();
  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const user = findByUsername(username.trim());

  if (!user) {
    // Don't reveal whether the user exists
    return NextResponse.json({ ok: true });
  }

  if (!user.reportEmail) {
    return NextResponse.json({ noEmail: true });
  }

  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const expiry = Date.now() + 60 * 60 * 1000; // 1 hour
  setResetToken(user.username, token, expiry);

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await sendPasswordReset(user.reportEmail, resetUrl);

  return NextResponse.json({ ok: true });
}
