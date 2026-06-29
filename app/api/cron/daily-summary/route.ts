import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getPreferences, getPushSubscription } from "@/lib/users";
import { buildReportData } from "@/lib/buildReport";
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
    const prefs = getPreferences(user.username);
    if (!prefs.pushSchedule?.daily) { results.push({ username: user.username, status: "skipped (not opted in)" }); continue; }

    const subscription = getPushSubscription(user.username);
    if (!subscription) { results.push({ username: user.username, status: "no push subscription" }); continue; }

    const data = await buildReportData(user.username);
    if (!data) { results.push({ username: user.username, status: "no stocks" }); continue; }

    try {
      const valueStr = formatCurrency(data.totalValueUSD ?? 0, data.currency, 0);
      const changeSign = (data.totalChange30dPct ?? 0) >= 0 ? "+" : "";
      const changePct = data.totalChange30dPct != null ? ` · 30d: ${changeSign}${data.totalChange30dPct.toFixed(2)}%` : "";
      const topGainer = data.stocks.find((s) => (s.change30d ?? -Infinity) > 0);
      const bestStr = topGainer ? ` · Best: ${topGainer.symbol} +${topGainer.change30d?.toFixed(1)}%` : "";
      await sendPushNotification(subscription, {
        title: "Daily Portfolio Summary",
        body: `${valueStr}${changePct}${bestStr}`,
        url: "/",
      });
      results.push({ username: user.username, status: "sent push" });
    } catch (err) {
      results.push({ username: user.username, status: `push error: ${err}` });
    }
  }

  return NextResponse.json({ results });
}
