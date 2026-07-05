import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getPushSubscription, getPreferences } from "@/lib/users";
import { getUserStocks } from "@/lib/stockStore";
import { sendPushNotification } from "@/lib/sendPush";

interface StoredStock {
  symbol: string;
  name: string;
  earningsDate?: string | null;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const testOnly = new URL(req.url).searchParams.get("test") === "1";
  const users = getAllUsers().filter((u) => !testOnly || u.username.toLowerCase() === "peter.carlsten");
  const results: { username: string; status: string }[] = [];

  for (const user of users) {
    const subscription = getPushSubscription(user.username);
    if (!subscription) {
      results.push({ username: user.username, status: "no push subscription" });
      continue;
    }

    const prefs = getPreferences(user.username);
    if (!prefs.pushSchedule?.earnings) {
      results.push({ username: user.username, status: "skipped (earnings notifications off)" });
      continue;
    }

    const stocks = getUserStocks(user.username) as StoredStock[];
    const todayStocks = stocks.filter((s) => s.earningsDate === today);

    if (todayStocks.length === 0) {
      results.push({ username: user.username, status: "no earnings today" });
      continue;
    }

    const names = todayStocks.map((s) => `${s.name} (${s.symbol})`);
    const body = names.length === 1
      ? `${names[0]} reports earnings today`
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} report earnings today`;

    try {
      await sendPushNotification(subscription, {
        title: "📊 Earnings Today",
        body,
        url: "/",
      });
      results.push({ username: user.username, status: `sent for: ${todayStocks.map((s) => s.symbol).join(", ")}` });
    } catch (err) {
      results.push({ username: user.username, status: `push error: ${err}` });
    }
  }

  return NextResponse.json({ date: today, results });
}
