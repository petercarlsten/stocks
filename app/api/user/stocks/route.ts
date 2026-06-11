import { NextRequest, NextResponse } from "next/server";
import { getServerSession, Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserStocks, saveUserStocks } from "@/lib/stockStore";

function getUsername(session: Session | null): string | null {
  return session?.user?.name ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const username = getUsername(session);
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(getUserStocks(username));
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const username = getUsername(session);
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stocks = await req.json();
  saveUserStocks(username, stocks);
  return NextResponse.json({ ok: true });
}
