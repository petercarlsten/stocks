import { NextRequest, NextResponse } from "next/server";

const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) return NextResponse.json([]);

  try {
    const words = q.split(/\s+/);
    let quotes: { symbol: string; name: string }[] = [];

    // Try progressively shorter queries until we get results
    for (let len = words.length; len >= 1 && quotes.length === 0; len--) {
      const query = words.slice(0, len).join(" ");
      const result = await yf.search(query, { quotesCount: 8, newsCount: 0 });
      quotes = (result.quotes ?? [])
        .filter((r: { typeDisp?: string; symbol?: string }) =>
          r.symbol && ["Equity", "ETF", "Fund", "Mutual Fund"].includes(r.typeDisp ?? "")
        )
        .map((r: { symbol: string; longname?: string; shortname?: string }) => ({
          symbol: r.symbol,
          name: r.longname ?? r.shortname ?? r.symbol,
        }));
    }

    return NextResponse.json(quotes);
  } catch {
    return NextResponse.json([]);
  }
}
