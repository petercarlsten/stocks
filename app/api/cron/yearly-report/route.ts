import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getReportEmail } from "@/lib/users";
import { buildYearlyReportData } from "@/lib/buildYearlyReport";
import { sendYearlyReport } from "@/lib/email";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const testOnly = new URL(req.url).searchParams.get("test") === "1";
  const users = getAllUsers().filter((u) => !testOnly || u.username.toLowerCase() === "peter.carlsten");
  const results: { username: string; status: string }[] = [];

  for (const user of users) {
    const email = getReportEmail(user.username);
    if (!email) continue;

    try {
      const data = await buildYearlyReportData(user.username);
      if (!data) { results.push({ username: user.username, status: "no stocks" }); continue; }
      await sendYearlyReport(email, data);
      results.push({ username: user.username, status: "sent" });
    } catch (err) {
      results.push({ username: user.username, status: `error: ${err}` });
    }
  }

  return NextResponse.json({ results });
}
