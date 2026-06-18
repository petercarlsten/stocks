import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getReportEmail } from "@/lib/users";
import { buildReportData } from "@/lib/buildReport";
import { sendMonthlyReport } from "@/lib/email";

export async function POST() {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name ?? null;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = getReportEmail(username);
  if (!email) return NextResponse.json({ error: "No report email set" }, { status: 400 });

  const data = await buildReportData(username);
  if (!data) return NextResponse.json({ error: "No stocks found" }, { status: 400 });

  await sendMonthlyReport(email, data);
  return NextResponse.json({ ok: true });
}
