import { NextRequest, NextResponse } from "next/server";

// yahoo-finance2 v3 uses a class-based API; bypass type mismatch with require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const includeName = req.nextUrl.searchParams.get("noName") !== "1";

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const upper = symbol.toUpperCase();
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);

  try {
    const [chart, quote] = await Promise.all([
      yf.chart(upper, { period1: start, period2: end, interval: "1d" }),
      includeName ? yf.quote(upper).catch(() => null) : Promise.resolve(null),
    ]);

    const data = (chart.quotes as Array<{ date: Date; close: number }>)
      .filter((row) => row.close != null)
      .map((row) => ({ date: row.date.toISOString().split("T")[0], close: row.close }));

    let name: string | null = null;
    if (includeName) {
      name = quote?.longName ?? quote?.shortName ?? null;
      // Funds and non-standard tickers often lack a name in quote(); try search()
      if (!name) {
        const results = await yf.search(upper).catch(() => null);
        type SearchQuote = { symbol?: string; longname?: string; shortname?: string; longName?: string; shortName?: string };
        const match = results?.quotes?.find(
          (q: SearchQuote) => q.symbol === upper
        ) as SearchQuote | undefined;
        name = match?.longname ?? match?.longName ?? match?.shortname ?? match?.shortName ?? upper;
      }
    }

    return NextResponse.json({ symbol: upper, name, data });
  } catch {
    return NextResponse.json(
      { error: `Could not fetch data for "${upper}"` },
      { status: 404 }
    );
  }
}
