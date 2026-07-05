import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getReportEmail, getPushSubscription, getPreferences } from "@/lib/users";
import { buildYearlyReportData } from "@/lib/buildYearlyReport";
import { sendYearlyReport } from "@/lib/email";
import { sendPushNotification } from "@/lib/sendPush";
import { formatCurrency } from "@/app/lib/formatCurrency";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const testOnly = new URL(req.url).searchParams.get("test") === "1";
  const users = getAllUsers().filter((u) => !testOnly || u.username.toLowerCase() === "peter.carlsten");
  const results: { username: string; status: string }[] = [];

  for (const user of users) {
    const data = await buildYearlyReportData(user.username);
    if (!data) { results.push({ username: user.username, status: "no stocks" }); continue; }

    const sent: string[] = [];

    // Email
    const email = getReportEmail(user.username);
    const prefs = getPreferences(user.username);
    if (email && (prefs.emailReports?.yearly ?? true)) {
      try { await sendYearlyReport(email, data); sent.push("email"); }
      catch (err) { results.push({ username: user.username, status: `email error: ${err}` }); }
    }

    // Push — only if opted in to yearly
    const subscription = getPushSubscription(user.username);
    if (subscription && prefs.pushSchedule?.yearly) {
      try {
        const valueStr = formatCurrency((data as { totalValueUSD?: number; currency: string }).totalValueUSD ?? 0, data.currency, 0);
        await sendPushNotification(subscription, {
          title: "Yearly Portfolio Report",
          body: `Your ${new Date().getFullYear() - 1} portfolio summary is ready. Total value: ${valueStr}`,
          url: "/",
        });
        sent.push("push");
      } catch (err) { results.push({ username: user.username, status: `push error: ${err}` }); }
    }

    if (sent.length > 0) results.push({ username: user.username, status: `sent: ${sent.join(", ")}` });
    else results.push({ username: user.username, status: "no notification configured" });
  }

  return NextResponse.json({ results });
}
