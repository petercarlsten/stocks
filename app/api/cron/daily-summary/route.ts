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
      const valueStr = formatCurrency(data.totalValueUSD, data.currency, 0);

      // Pick the most meaningful gain figure: all-time > 1yr > 30d
      const gainPct = data.totalChangeCostPct ?? data.totalChange1yrPct ?? data.totalChange30dPct;
      const gainLabel = data.totalChangeCostPct != null ? "all-time" : data.totalChange1yrPct != null ? "1yr" : "30d";
      const gainStr = gainPct != null ? ` · ${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}% (${gainLabel})` : "";

      const gainAbs = data.totalEarningsCostUSD ?? data.totalEarnings1yrUSD ?? data.totalEarnings30dUSD;
      const gainAbsStr = gainAbs != null ? ` ${gainAbs >= 0 ? "+" : ""}${formatCurrency(gainAbs, data.currency, 0)}` : "";

      await sendPushNotification(subscription, {
        title: "Portfolio update",
        body: `${valueStr}${gainAbsStr}${gainStr}`,
        url: "/",
      });
      results.push({ username: user.username, status: "sent push" });
    } catch (err) {
      results.push({ username: user.username, status: `push error: ${err}` });
    }
  }

  return NextResponse.json({ results });
}
