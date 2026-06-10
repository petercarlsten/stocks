import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

// Cache for 1 hour — revalidated automatically by Next.js
export const revalidate = 3600;

const UNIVERSE = [
  "AAPL","MSFT","GOOGL","AMZN","NVDA","TSLA","META","JPM","V","WMT",
  "UNH","XOM","HD","AVGO","LLY","MA","ABBV","COST","PG","NFLX",
  "ORCL","CRM","AMD","QCOM","NOW","BAC","JNJ","GS","CAT","UBER",
];

export async function GET() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);

  const results = await Promise.allSettled(
    UNIVERSE.map(async (symbol) => {
      const chart = await yf.chart(symbol, { period1: start, period2: end, interval: "1mo" });
      const quotes = (chart.quotes as Array<{ close: number }>).filter((q) => q.close != null);
      if (quotes.length < 2) throw new Error("insufficient data");
      const gain = ((quotes[quotes.length - 1].close - quotes[0].close) / quotes[0].close) * 100;
      const quote = await yf.quote(symbol).catch(() => null);
      const name = quote?.longName ?? quote?.shortName ?? symbol;
      return { symbol, name, gain };
    })
  );

  const gainers = results
    .filter((r): r is PromiseFulfilledResult<{ symbol: string; name: string; gain: number }> =>
      r.status === "fulfilled"
    )
    .map((r) => r.value)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 6);

  return NextResponse.json(gainers);
}
