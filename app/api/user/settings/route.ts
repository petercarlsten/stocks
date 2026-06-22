import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getReportEmail, setReportEmail, getReportCurrency, setReportCurrency, updateLastSeen, isAdmin } from "@/lib/users";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name ?? null;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ua = req.headers.get("user-agent") ?? undefined;
  updateLastSeen(username, ua);
  return NextResponse.json({
    reportEmail: getReportEmail(username),
    reportCurrency: getReportCurrency(username),
    isAdmin: isAdmin(username),
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name ?? null;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (typeof body.reportEmail === "string") setReportEmail(username, body.reportEmail.trim());
  if (typeof body.reportCurrency === "string") setReportCurrency(username, body.reportCurrency.trim());
  return NextResponse.json({ ok: true });
}
