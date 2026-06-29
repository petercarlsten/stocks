import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getReportEmail, getPushSubscription, getPreferences } from "@/lib/users";
import { buildReportData } from "@/lib/buildReport";
import { sendMonthlyReport } from "@/lib/email";
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
    const data = await buildReportData(user.username);
    if (!data) { results.push({ username: user.username, status: "no stocks" }); continue; }

    const sent: string[] = [];

    // Email
    const email = getReportEmail(user.username);
    if (email) {
      try { await sendMonthlyReport(email, data); sent.push("email"); }
      catch (err) { results.push({ username: user.username, status: `email error: ${err}` }); }
    }

    // Push notification — only if user opted in to monthly
    const prefs = getPreferences(user.username);
    const subscription = getPushSubscription(user.username);
    if (subscription && (prefs.pushSchedule?.monthly ?? true)) {
      try {
        const topGainer = data.stocks.find((s) => (s.change30d ?? -Infinity) > 0);
        const valueStr = formatCurrency(data.totalValueUSD ?? 0, data.currency, 0);
        const changeSign = (data.totalChange30dPct ?? 0) >= 0 ? "+" : "";
        const changePct = data.totalChange30dPct != null ? `${changeSign}${data.totalChange30dPct.toFixed(2)}%` : "";
        const gainStr = data.totalEarnings30dUSD != null
          ? ` (${changeSign}${formatCurrency(data.totalEarnings30dUSD, data.currency, 0)})`
          : "";
        const body = [
          `Portfolio: ${valueStr}`,
          changePct ? `30-day: ${changePct}${gainStr}` : null,
          topGainer ? `Best: ${topGainer.name.length > 20 ? topGainer.name.slice(0, 20) + "…" : topGainer.name} +${topGainer.change30d?.toFixed(2)}%` : null,
        ].filter(Boolean).join(" · ");
        await sendPushNotification(subscription, { title: "Monthly Portfolio Report", body, url: "/" });
        sent.push("push");
      } catch (err) { results.push({ username: user.username, status: `push error: ${err}` }); }
    }

    if (sent.length > 0) results.push({ username: user.username, status: `sent: ${sent.join(", ")}` });
    else results.push({ username: user.username, status: "no notification configured" });
  }

  return NextResponse.json({ results });
}
