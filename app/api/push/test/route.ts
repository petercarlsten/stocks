import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPushSubscription } from "@/lib/users";
import { buildReportData } from "@/lib/buildReport";
import { sendPushNotification } from "@/lib/sendPush";
import { formatCurrency } from "@/app/lib/formatCurrency";

export async function POST() {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name ?? null;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = getPushSubscription(username);
  if (!subscription) return NextResponse.json({ error: "No push subscription found" }, { status: 400 });

  const data = await buildReportData(username);
  if (!data) return NextResponse.json({ error: "No portfolio data" }, { status: 400 });

  const topGainer = data.stocks.find((s) => (s.change30d ?? -Infinity) > 0);
  const valueStr = formatCurrency(data.totalValueUSD ?? 0, data.currency, 0);
  const changeSign = (data.totalChange30dPct ?? 0) >= 0 ? "+" : "";
  const changePct = data.totalChange30dPct != null ? `${changeSign}${data.totalChange30dPct.toFixed(2)}%` : "";
  const gainStr = data.totalEarnings30dUSD != null
    ? ` (${changeSign}${formatCurrency(data.totalEarnings30dUSD, data.currency, 0)})`
    : "";

  const realizedStr = data.totalRealizedGainUSD != null
    ? `Realized: ${changeSign}${formatCurrency(data.totalRealizedGainUSD, data.currency, 0)}`
    : null;

  const body = [
    `Portfolio: ${valueStr}`,
    changePct ? `30-day: ${changePct}${gainStr}` : null,
    realizedStr,
    topGainer ? `Best: ${topGainer.name.length > 20 ? topGainer.name.slice(0, 20) + "…" : topGainer.name} +${topGainer.change30d?.toFixed(2)}%` : null,
  ].filter(Boolean).join(" · ");

  await sendPushNotification(subscription, {
    title: "Monthly Portfolio Report",
    body,
    url: "/",
  });

  return NextResponse.json({ ok: true });
}
