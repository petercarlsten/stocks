import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getReportEmail, setReportEmail } from "@/lib/users";

export async function GET() {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name ?? null;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ reportEmail: getReportEmail(username) });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name ?? null;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { reportEmail } = await req.json();
  setReportEmail(username, typeof reportEmail === "string" ? reportEmail.trim() : "");
  return NextResponse.json({ ok: true });
}
