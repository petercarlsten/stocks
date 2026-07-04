import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/users";

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Test secret always passes — skip verification in dev if no key set
  if (!secret || secret === "1x0000000000000000000000000000000AA") return true;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { username, password, email, turnstileToken } = await req.json();

  if (!username || typeof username !== "string" || username.trim().length < 3) {
    return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }
  if (!turnstileToken || typeof turnstileToken !== "string") {
    return NextResponse.json({ error: "Human verification required" }, { status: 400 });
  }

  const human = await verifyTurnstile(turnstileToken);
  if (!human) {
    return NextResponse.json({ error: "Human verification failed — please try again" }, { status: 403 });
  }

  try {
    await createUser(username.trim(), password, email.trim().toLowerCase());
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create account";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
