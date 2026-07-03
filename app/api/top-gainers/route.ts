import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

// Cache for 1 hour — revalidated automatically by Next.js
export const revalidate = 3600;

type Region = "AMER" | "EMEA" | "APAC";

const UNIVERSE: { symbol: string; region: Region }[] = [
  // AMER
  ...["AAPL","MSFT","GOOGL","AMZN","NVDA","TSLA","META","JPM","V","WMT",
      "UNH","XOM","HD","AVGO","LLY","MA","ABBV","COST","PG","NFLX",
      "ORCL","CRM","AMD","QCOM","NOW","BAC","JNJ","GS","CAT","UBER",
  ].map(s => ({ symbol: s, region: "AMER" as Region })),
  // EMEA
  ...["ASML.AS","SAP.DE","MC.PA","RMS.PA","NESN.SW","NOVO-B.CO","ROG.SW",
      "SIE.DE","AIR.PA","TTE.PA","AZN.L","SHEL.L","ULVR.L","BP.L",
      "OR.PA","ALV.DE","DTE.DE","BAYN.DE","BNP.PA","NOVN.SW",
  ].map(s => ({ symbol: s, region: "EMEA" as Region })),
  // APAC
  ...["7203.T","6758.T","9984.T","6861.T","7974.T",
      "0700.HK","9988.HK","1211.HK","3690.HK",
      "TSM","005930.KS","000660.KS",
      "RELIANCE.NS","INFY","TCS.NS",
  ].map(s => ({ symbol: s, region: "APAC" as Region })),
];

async function fetchOne(symbol: string, region: Region, start: Date, end: Date) {
  const chart = await yf.chart(symbol, { period1: start, period2: end, interval: "1d" }, { validateResult: false });
  const quotes = (chart.quotes as Array<{ close: number }>).filter((q) => q.close != null);
  if (quotes.length < 2) throw new Error("insufficient data");
  const gain = ((quotes[quotes.length - 1].close - quotes[0].close) / quotes[0].close) * 100;
  const quote = await yf.quote(symbol).catch(() => null);
  const name = quote?.longName ?? quote?.shortName ?? symbol;
  return { symbol, name, gain, region };
}

export async function GET() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);

  const BATCH = 15;
  const all: { symbol: string; name: string; gain: number; region: Region }[] = [];

  for (let i = 0; i < UNIVERSE.length; i += BATCH) {
    const batch = UNIVERSE.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(({ symbol, region }) => fetchOne(symbol, region, start, end))
    );
    for (const r of results) {
      if (r.status === "fulfilled") all.push(r.value);
    }
  }

  return NextResponse.json(all.sort((a, b) => b.gain - a.gain));
}
