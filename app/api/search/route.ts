import { NextRequest, NextResponse } from "next/server";

const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) return NextResponse.json([]);

  try {
    const result = await yf.search(q, { quotesCount: 8, newsCount: 0 });
    const quotes = (result.quotes ?? [])
      .filter((r: { typeDisp?: string; symbol?: string }) =>
        r.symbol && ["Equity", "ETF", "Fund", "Mutual Fund"].includes(r.typeDisp ?? "")
      )
      .map((r: { symbol: string; longname?: string; shortname?: string }) => ({
        symbol: r.symbol,
        name: r.longname ?? r.shortname ?? r.symbol,
      }));
    return NextResponse.json(quotes);
  } catch {
    return NextResponse.json([]);
  }
}
