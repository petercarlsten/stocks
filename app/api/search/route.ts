import { NextRequest, NextResponse } from "next/server";

const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

// OpenFIGI exchCode → Yahoo Finance ticker suffix
const EXCH_SUFFIX: Record<string, string> = {
  US: "",    SS: ".ST", LN: ".L",  GR: ".MU", FP: ".PA",
  SM: ".MC", IT: ".MI", NA: ".AS", DC: ".CO", HO: ".HE",
  NO: ".OL", SW: ".SW", BB: ".BR", AV: ".VI",
  HK: ".HK", JP: ".T",  AU: ".AX", SG: ".SI", MK: ".KL",
  IN: ".NS",
};

const FIGI_TYPES = [
  "Common Stock", "ETP", "ETF",
  "Open-End Fund", "Closed-End Fund", "Fund of Funds", "Mutual Fund",
  "Preferred Stock",
];

interface Quote { symbol: string; name: string; }

async function searchYahoo(q: string): Promise<Quote[]> {
  const words = q.split(/\s+/);
  for (let len = words.length; len >= 1; len--) {
    const query = words.slice(0, len).join(" ");
    try {
      const result = await yf.search(query, { quotesCount: 8, newsCount: 0 });
      const quotes: Quote[] = (result.quotes ?? [])
        .filter((r: { typeDisp?: string; symbol?: string }) =>
          r.symbol && ["Equity", "ETF", "Fund", "Mutual Fund"].includes(r.typeDisp ?? "")
        )
        .map((r: { symbol: string; longname?: string; shortname?: string }) => ({
          symbol: r.symbol,
          name: r.longname ?? r.shortname ?? r.symbol,
        }));
      if (quotes.length > 0) return quotes;
    } catch { /* continue */ }
  }
  return [];
}

async function searchOpenFIGI(q: string): Promise<Quote[]> {
  const words = q.split(/\s+/);
  for (let len = words.length; len >= 1; len--) {
    const query = words.slice(0, len).join(" ");
    try {
      const res = await fetch("https://api.openfigi.com/v3/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) continue;
      const json = await res.json();

      interface FIGIResult { ticker?: string; name?: string; exchCode?: string; securityType?: string; }
      const results: Quote[] = (json.data ?? [])
        .filter((d: FIGIResult) => d.ticker && FIGI_TYPES.includes(d.securityType ?? ""))
        .map((d: FIGIResult) => ({
          symbol: `${d.ticker}${EXCH_SUFFIX[d.exchCode ?? ""] ?? ""}`,
          name: d.name ?? d.ticker ?? "",
          exchCode: d.exchCode ?? "",
        }))
        .sort((a: { exchCode: string }, b: { exchCode: string }) =>
          a.exchCode === "US" ? -1 : b.exchCode === "US" ? 1 : 0
        )
        .slice(0, 8)
        .map(({ symbol, name }: Quote) => ({ symbol, name }));

      if (results.length > 0) return results;
    } catch { /* continue */ }
  }
  return [];
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/i;
const PARTIAL_ISIN_RE = /^[A-Z]{2}[A-Z0-9]{1,9}$/i;

async function resolveISIN(isin: string): Promise<Quote[]> {
  try {
    const res = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin.toUpperCase() }]),
    });
    if (!res.ok) return [];
    const json = await res.json();
    interface FIGIResult { ticker?: string; name?: string; exchCode?: string; securityType?: string; }
    const data: FIGIResult[] = json[0]?.data ?? [];
    const seen = new Set<string>();
    return data
      .filter((d) => d.ticker && FIGI_TYPES.includes(d.securityType ?? ""))
      .map((d) => ({
        symbol: `${d.ticker}${EXCH_SUFFIX[d.exchCode ?? ""] ?? ""}`,
        name: d.name ?? d.ticker ?? "",
        exchCode: d.exchCode ?? "",
      }))
      .sort((a, b) => a.exchCode === "US" ? -1 : b.exchCode === "US" ? 1 : 0)
      .filter(({ symbol, exchCode }) =>
        exchCode in EXCH_SUFFIX && /^[A-Z0-9.^-]+$/i.test(symbol) && !seen.has(symbol) && seen.add(symbol)
      )
      .slice(0, 6)
      .map(({ symbol, name }) => ({ symbol, name }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);

  if (ISIN_RE.test(q)) {
    const isinResults = await resolveISIN(q);
    if (isinResults.length > 0) return NextResponse.json(isinResults);
  }

  // Looks like an incomplete ISIN (has digits) — don't fuzzy-search, just wait
  if (PARTIAL_ISIN_RE.test(q) && /\d/.test(q)) return NextResponse.json([]);

  const yahooResults = await searchYahoo(q);
  if (yahooResults.length > 0) return NextResponse.json(yahooResults);

  return NextResponse.json(await searchOpenFIGI(q));
}
