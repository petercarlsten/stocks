import { NextRequest, NextResponse } from "next/server";

// yahoo-finance2 v3 uses a class-based API; bypass type mismatch with require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

// Yahoo Finance suffix → EODHD exchange code
const YAHOO_TO_EODHD: Record<string, string> = {
  "":     "US",   ".L":  "LSE",  ".DE": "XETRA", ".MU": "MU",
  ".HA":  "HA",   ".HM": "HH",   ".SG": "STU",   ".F":  "F",
  ".BE":  "BE",   ".DU": "DU",   ".ST": "STO",   ".PA": "PA",
  ".AS":  "AS",   ".MI": "MIL",  ".MC": "MC",    ".SW": "SW",
  ".CO":  "CO",   ".HE": "HE",   ".OL": "OSL",   ".BR": "BR",
  ".VI":  "VI",   ".HK": "HK",   ".T":  "TSE",   ".AX": "AU",
  ".SI":  "SG",   ".KL": "KLSE", ".NS": "NSE",
};

function toEODHDSymbol(yahooSymbol: string): string | null {
  const dotIdx = yahooSymbol.lastIndexOf(".");
  const base   = dotIdx >= 0 ? yahooSymbol.slice(0, dotIdx) : yahooSymbol;
  const suffix = dotIdx >= 0 ? yahooSymbol.slice(dotIdx) : "";
  const exch   = YAHOO_TO_EODHD[suffix];
  return exch != null ? `${base}.${exch}` : null;
}

// In-memory cache for EODHD responses — survives across requests in the same process.
// Keyed by EODHD symbol; value is the fetched rows + the date they were cached.
// TTL: 6 hours, so we refresh intraday but never burn through the 1200/day limit.
const EODHD_CACHE = new Map<string, { rows: { date: string; close: number }[]; cachedAt: number }>();
const EODHD_TTL_MS = 6 * 60 * 60 * 1000;

// Tracks whether we've already hit the 402 rate limit today (resets on server restart).
let eohdRateLimited = false;

async function searchEODHD(query: string): Promise<{ name: string | null; isin: string | null }> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey || eohdRateLimited) return { name: null, isin: null };
  try {
    const res = await fetch(`https://eodhd.com/api/search/${encodeURIComponent(query)}?api_token=${apiKey}`);
    if (res.status === 402) { eohdRateLimited = true; return { name: null, isin: null }; }
    if (!res.ok) return { name: null, isin: null };
    const rows: Array<{ Name?: string; ISIN?: string; Code?: string }> = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return { name: null, isin: null };
    const match = rows.find((r) => r.ISIN === query.toUpperCase()) ?? rows[0];
    return { name: match?.Name ?? null, isin: match?.ISIN ?? null };
  } catch {
    return { name: null, isin: null };
  }
}

async function fetchFromEODHD(
  eodhSymbol: string,
  start: Date,
  end: Date
): Promise<{ date: string; close: number }[] | null> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey || eohdRateLimited) return null;

  const cached = EODHD_CACHE.get(eodhSymbol);
  if (cached && Date.now() - cached.cachedAt < EODHD_TTL_MS) {
    return cached.rows;
  }

  const from = start.toISOString().split("T")[0];
  const to   = end.toISOString().split("T")[0];
  const url  = `https://eodhd.com/api/eod/${encodeURIComponent(eodhSymbol)}?api_token=${apiKey}&from=${from}&to=${to}&fmt=json`;

  try {
    const res = await fetch(url);
    if (res.status === 402) { eohdRateLimited = true; return null; }
    if (!res.ok) return null;
    const rows: Array<{ date: string; close: number }> = await res.json();
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const result = rows.map((r) => ({ date: r.date, close: r.close }));
    EODHD_CACHE.set(eodhSymbol, { rows: result, cachedAt: Date.now() });
    return result;
  } catch {
    return null;
  }
}

const SUFFIX_CURRENCY: Record<string, string> = {
  "": "USD", ".L": "GBP", ".DE": "EUR", ".MU": "EUR", ".HA": "EUR",
  ".HM": "EUR", ".SG": "EUR", ".F": "EUR", ".BE": "EUR", ".DU": "EUR",
  ".ST": "SEK", ".PA": "EUR", ".AS": "EUR", ".MI": "EUR", ".MC": "EUR",
  ".SW": "CHF", ".CO": "DKK", ".HE": "EUR", ".OL": "NOK", ".BR": "EUR",
  ".VI": "EUR", ".HK": "HKD", ".T": "JPY", ".AX": "AUD", ".SI": "SGD",
  ".KL": "MYR", ".NS": "INR",
};

function inferCurrencyFromSuffix(symbol: string): string {
  const dotIdx = symbol.lastIndexOf(".");
  const suffix = dotIdx >= 0 ? symbol.slice(dotIdx) : "";
  return SUFFIX_CURRENCY[suffix] ?? "USD";
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/i;

async function resolveISIN(isin: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin.toUpperCase() }]),
    });
    if (!res.ok) return null;
    const json = await res.json();
    interface FIGIResult { ticker?: string; exchCode?: string; securityType?: string; }
    const data: FIGIResult[] = json[0]?.data ?? [];
    const EXCH_SUFFIX: Record<string, string> = {
      US: "",    LN: ".L",  GR: ".MU", FP: ".PA", SS: ".ST",
      SM: ".MC", IT: ".MI", NA: ".AS", DC: ".CO", HO: ".HE",
      NO: ".OL", SW: ".SW", BB: ".BR", AV: ".VI",
      HK: ".HK", JP: ".T",  AU: ".AX", SG: ".SI", MK: ".KL", IN: ".NS",
    };
    const FUND_TYPES = ["Common Stock", "ETP", "ETF", "Open-End Fund", "Closed-End Fund", "Mutual Fund", "Preferred Stock"];
    const match = data
      .filter((d) => d.ticker && d.exchCode && d.exchCode in EXCH_SUFFIX && FUND_TYPES.includes(d.securityType ?? ""))
      .sort((a, b) => a.exchCode === "US" ? -1 : b.exchCode === "US" ? 1 : 0)[0];
    if (!match?.ticker) return null;
    return `${match.ticker}${EXCH_SUFFIX[match.exchCode!]}`;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const includeName = req.nextUrl.searchParams.get("noName") !== "1";
  const nameHint = req.nextUrl.searchParams.get("name") ?? undefined;

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  let upper = symbol.toUpperCase();
  let originalISIN: string | null = null;

  // If the user submitted a raw ISIN, resolve it to a ticker first
  if (ISIN_RE.test(upper)) {
    originalISIN = upper;
    const resolved = await resolveISIN(upper);
    if (resolved) {
      upper = resolved.toUpperCase();
    }
    // If resolution fails we'll still try ISIN.EUFUND via EODHD below
  }
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);

  try {
    // Always fetch quote for earnings date; name lookup is optional
    // yf.chart can throw for bare ISINs or obscure tickers — treat that as 0 rows
    // so we still fall through to the EODHD fallback below.
    const [chartResult, quote] = await Promise.all([
      yf.chart(upper, { period1: start, period2: end, interval: "1d" }, { validateResult: false }).catch(() => null),
      yf.quote(upper, {}, { validateResult: false }).catch(() => null),
    ]);

    let data = chartResult
      ? (chartResult.quotes as Array<{ date: Date; close: number }>)
          .filter((row) => row.close != null)
          .map((row) => ({ date: row.date.toISOString().split("T")[0], close: row.close }))
      : [];

    // Fall back to EODHD when Yahoo has no or sparse history
    if (data.length < 5) {
      const eodhdTicker = toEODHDSymbol(upper);
      const debugSteps: string[] = [];

      debugSteps.push(`Yahoo quotes: ${data.length} (symbol="${upper}")`);

      let eodhd: { date: string; close: number }[] | null = null;

      if (eodhdTicker) {
        eodhd = await fetchFromEODHD(eodhdTicker, start, end);
        debugSteps.push(`EODHD ${eodhdTicker}: ${eodhd ? eodhd.length + " rows" : "null"}`);
      }

      if (!eodhd && originalISIN) {
        eodhd = await fetchFromEODHD(`${originalISIN}.EUFUND`, start, end);
        debugSteps.push(`EODHD ${originalISIN}.EUFUND: ${eodhd ? eodhd.length + " rows" : "null"}`);
      }

      // Last resort: no data and no ISIN — try to discover the ISIN from the ticker.
      // Strategy: OpenFIGI ticker+exchange → fund name → EODHD name search → ISIN.EUFUND.
      // (EODHD fundamentals endpoint 403s on our plan, so we skip it.)
      if (!eodhd && !originalISIN) {
        let recoveredISIN: string | null = null;
        const dotIdx = upper.lastIndexOf(".");
        const base = dotIdx >= 0 ? upper.slice(0, dotIdx) : upper;
        const suffix = dotIdx >= 0 ? upper.slice(dotIdx) : "";

        // 1. OpenFIGI: ticker + exchange → fund name (free, no quota)
        const YAHOO_TO_OPENFIGI: Record<string, string> = {
          ".MU": "GR", ".DE": "GR", ".F": "GR", ".BE": "GR", ".HA": "GR",
          ".HM": "GR", ".SG": "GR", ".DU": "GR",
          ".L": "LN", ".PA": "FP", ".AS": "NA", ".MI": "IT", ".MC": "SM",
          ".ST": "SS", ".CO": "DC", ".HE": "HO", ".OL": "NO", ".SW": "SW",
          ".BR": "BB", ".VI": "AV",
        };
        const openFigiExch = YAHOO_TO_OPENFIGI[suffix];
        let figiName: string | null = null;
        if (openFigiExch) {
          try {
            const res = await fetch("https://api.openfigi.com/v3/mapping", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify([{ idType: "TICKER", idValue: base, exchCode: openFigiExch }]),
            });
            if (res.ok) {
              const json = await res.json();
              figiName = json[0]?.data?.[0]?.name ?? null;
            }
            debugSteps.push(`OpenFIGI ticker=${base} exch=${openFigiExch}: name=${figiName}`);
          } catch (e) {
            debugSteps.push(`OpenFIGI: threw ${String(e)}`);
          }
        }

        // 2. EODHD search: try base ticker, then OpenFIGI name, then caller name hint
        const searchTerms = [base, figiName, nameHint].filter(Boolean) as string[];
        for (const term of searchTerms) {
          if (recoveredISIN) break;
          const { isin } = await searchEODHD(term);
          debugSteps.push(`EODHD search "${term.slice(0, 60)}": isin=${isin}`);
          if (isin) recoveredISIN = isin;
        }

        if (recoveredISIN) {
          originalISIN = recoveredISIN;
          eodhd = await fetchFromEODHD(`${recoveredISIN}.EUFUND`, start, end);
          debugSteps.push(`EODHD ${recoveredISIN}.EUFUND: ${eodhd ? eodhd.length + " rows" : "null"}`);
        }
      }

      if (eodhd) {
        data = eodhd;
      } else {
        const rateLimited = eohdRateLimited;
        const detail = debugSteps.join(" → ");
        console.error(`[stocks] No data for "${symbol}": ${detail}`);
        const hint = rateLimited
          ? " EODHD daily API limit reached — data will be available again tomorrow."
          : process.env.EODHD_API_KEY ? "" : " Add EODHD_API_KEY to .env.local for broader coverage.";
        return NextResponse.json(
          { error: `No price data found for "${symbol.toUpperCase()}".${hint}`, debug: detail },
          { status: 404 }
        );
      }
    }

    // Earnings date — available for equities, not funds
    let earningsDate: string | null = null;
    const ts = quote?.earningsTimestampEnd ?? quote?.earningsTimestamp ?? quote?.earningsTimestampStart;
    if (ts) {
      const d = ts instanceof Date ? ts : new Date((ts as number) * 1000);
      if (!isNaN(d.getTime())) earningsDate = d.toISOString().split("T")[0];
    }

    let name: string | null = null;
    if (includeName) {
      name = quote?.longName ?? quote?.shortName ?? null;
      // Funds and non-standard tickers often lack a name in quote(); try Yahoo search
      if (!name) {
        const results = await yf.search(upper).catch(() => null);
        type SearchQuote = { symbol?: string; longname?: string; shortname?: string; longName?: string; shortName?: string };
        const match = results?.quotes?.find(
          (q: SearchQuote) => q.symbol === upper
        ) as SearchQuote | undefined;
        name = match?.longname ?? match?.longName ?? match?.shortname ?? match?.shortName ?? null;
      }
      // If name looks abbreviated (e.g. "FR.TEMP.INV.FDS"), try EODHD for a proper name
      const looksAbbreviated = !name || /[A-Z]\.[A-Z]/.test(name);
      if (looksAbbreviated) {
        const { name: eodhdName } = await searchEODHD(originalISIN ?? upper);
        name = eodhdName ?? name ?? upper;
      }
    }

    const currency = quote?.currency ?? inferCurrencyFromSuffix(upper);
    // Preserve the original ISIN as the symbol so every refresh re-enters the ISIN path
    // and can fall back to {ISIN}.EUFUND; resolved tickers like TESG.MU have no EODHD data.
    const responseSymbol = originalISIN ?? upper;
    return NextResponse.json({ symbol: responseSymbol, name, earningsDate, data, currency });
  } catch {
    return NextResponse.json(
      { error: `Could not fetch data for "${upper}"` },
      { status: 404 }
    );
  }
}
