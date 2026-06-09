import { NextRequest, NextResponse } from "next/server";

// yahoo-finance2 v3 uses a class-based API; bypass type mismatch with require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);

  try {
    const upper = symbol.toUpperCase();
    const [chart, quote] = await Promise.all([
      yf.chart(upper, { period1: start, period2: end, interval: "1d" }),
      yf.quote(upper),
    ]);

    const data = (chart.quotes as Array<{ date: Date; close: number }>)
      .filter((row) => row.close != null)
      .map((row) => ({
        date: row.date.toISOString().split("T")[0],
        close: row.close,
      }));

    const name: string = quote.shortName ?? quote.longName ?? upper;

    return NextResponse.json({ symbol: upper, name, data });
  } catch {
    return NextResponse.json(
      { error: `Could not fetch data for "${symbol}"` },
      { status: 404 }
    );
  }
}
