import { NextRequest, NextResponse } from "next/server";

const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/i;

// OpenFIGI exchCode → Yahoo Finance ticker suffix
const EXCH_SUFFIX: Record<string, string> = {
  US: "",   SS: ".ST", LN: ".L",  GR: ".DE", FP: ".PA",
  SM: ".MC", IT: ".MI", NA: ".AS", DC: ".CO", HO: ".HE",
  NO: ".OL", SW: ".SW", BB: ".BR", AV: ".VI",
};

async function resolveISIN(isin: string) {
  try {
    const res = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin.toUpperCase() }]),
    });
    if (!res.ok) return [];

    const [result] = await res.json();
    if (!result?.data) return [];

    interface FIGIEntry { ticker?: string; name?: string; exchCode?: string; securityType?: string; }

    return result.data
      .filter((d: FIGIEntry) =>
        d.ticker && ["Common Stock", "ETP", "ETF", "Preferred Stock"].includes(d.securityType ?? "")
      )
      .map((d: FIGIEntry) => ({
        symbol: `${d.ticker}${EXCH_SUFFIX[d.exchCode ?? ""] ?? ""}`,
        name: d.name ?? d.ticker ?? "",
        exchCode: d.exchCode ?? "",
      }))
      .sort((a: { exchCode: string }, b: { exchCode: string }) =>
        a.exchCode === "US" ? -1 : b.exchCode === "US" ? 1 : 0
      )
      .slice(0, 6)
      .map(({ symbol, name }: { symbol: string; name: string }) => ({ symbol, name }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);

  if (ISIN_RE.test(q)) {
    return NextResponse.json(await resolveISIN(q));
  }

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
