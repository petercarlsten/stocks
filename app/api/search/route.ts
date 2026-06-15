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

// Reverse of the YAHOO_TO_EODHD map in stocks/route.ts
const EODHD_TO_YAHOO_SUFFIX: Record<string, string> = {
  "US": "", "LSE": ".L", "XETRA": ".DE", "MU": ".MU", "HA": ".HA",
  "HH": ".HM", "STU": ".SG", "F": ".F", "BE": ".BE", "DU": ".DU",
  "STO": ".ST", "PA": ".PA", "AS": ".AS", "MIL": ".MI", "MC": ".MC",
  "SW": ".SW", "CO": ".CO", "HE": ".HE", "OSL": ".OL", "BR": ".BR",
  "VI": ".VI", "HK": ".HK", "TSE": ".T", "AU": ".AX", "SG": ".SI",
  "KLSE": ".KL", "NSE": ".NS",
};

const EODHD_TYPES = ["Common Stock", "ETF", "ETP", "Fund", "FUND", "Open-End Fund", "Closed-End Fund", "Mutual Fund", "Fund of Funds"];

async function searchEODHD(q: string): Promise<Quote[]> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(`https://eodhd.com/api/search/${encodeURIComponent(q)}?api_token=${apiKey}&limit=8`);
    if (!res.ok) return [];
    const rows: Array<{ Code?: string; Exchange?: string; Name?: string; Type?: string }> = await res.json();
    return rows
      .filter((r) => r.Code && r.Exchange && EODHD_TYPES.includes(r.Type ?? ""))
      .map((r) => {
        const exch = r.Exchange!;
        const code = r.Code!;
        // EUFUND funds use ISIN as Code — return the ISIN; stocks route resolves via ISIN.EUFUND
        const symbol = exch === "EUFUND" ? code : `${code}${EODHD_TO_YAHOO_SUFFIX[exch] ?? ""}`;
        return { symbol, name: r.Name ?? code };
      })
      .slice(0, 8);
  } catch {
    return [];
  }
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
    // Run EODHD and OpenFIGI in parallel.
    // EODHD returns the ISIN as symbol for EUFUND funds (stocks route handles ISIN.EUFUND).
    // OpenFIGI returns exchange tickers (e.g. TESG.MU) which lack EODHD data — use only as fallback.
    const [eodhResults, figiResults] = await Promise.all([searchEODHD(q), resolveISIN(q)]);
    const combined = eodhResults.length > 0 ? eodhResults : figiResults;
    if (combined.length > 0) return NextResponse.json(combined);
  }

  // Looks like an incomplete ISIN (has digits) — don't fuzzy-search, just wait
  if (PARTIAL_ISIN_RE.test(q) && /\d/.test(q)) return NextResponse.json([]);

  // Run Yahoo and EODHD in parallel so funds appear alongside equities
  const [yahooResults, eodhResults] = await Promise.all([
    searchYahoo(q),
    searchEODHD(q),
  ]);

  const seen = new Set(yahooResults.map((r) => r.symbol));
  const merged = [
    ...yahooResults,
    ...eodhResults.filter((r) => !seen.has(r.symbol)),
  ].slice(0, 8);

  if (merged.length > 0) return NextResponse.json(merged);

  return NextResponse.json(await searchOpenFIGI(q));
}
