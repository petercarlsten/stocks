import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/users";
import { getUserStocks } from "@/lib/stockStore";
import { buildReportData } from "@/lib/buildReport";

export async function GET() {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name ?? null;
  if (!username || !isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rawStocks = getUserStocks(username) as Record<string, unknown>[];

  const stockSummary = rawStocks.map((s) => {
    const data = (s.data as { date: string; close: number }[] | undefined) ?? [];
    const purchases = (s.purchases as { shares: number; price?: number }[] | undefined) ?? [];
    return {
      symbol: s.symbol,
      dataPoints: data.length,
      lastClose: data[data.length - 1]?.close ?? null,
      lastDate: data[data.length - 1]?.date ?? null,
      shares: purchases.reduce((sum, p) => sum + p.shares, 0),
      hasPurchases: purchases.length > 0,
      currency: s.currency,
    };
  });

  const report = await buildReportData(username);

  return NextResponse.json({
    stockSummary,
    report: report ? {
      totalValue: report.totalValueUSD,
      currency: report.currency,
      change30dPct: report.totalChange30dPct,
      change1yrPct: report.totalChange1yrPct,
      changeCostPct: report.totalChangeCostPct,
    } : null,
  });
}
