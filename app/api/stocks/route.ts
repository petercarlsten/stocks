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

async function fetchNameFromEODHD(query: string): Promise<string | null> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://eodhd.com/api/search/${encodeURIComponent(query)}?api_token=${apiKey}`);
    if (!res.ok) return null;
    const rows: Array<{ Name?: string; ISIN?: string; Code?: string }> = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    // Prefer exact ISIN match, otherwise first result
    const match = rows.find((r) => r.ISIN === query.toUpperCase()) ?? rows[0];
    return match?.Name ?? null;
  } catch {
    return null;
  }
}

async function fetchFromEODHD(
  eodhSymbol: string,
  start: Date,
  end: Date
): Promise<{ date: string; close: number }[] | null> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) return null;

  const from = start.toISOString().split("T")[0];
  const to   = end.toISOString().split("T")[0];
  const url  = `https://eodhd.com/api/eod/${encodeURIComponent(eodhSymbol)}?api_token=${apiKey}&from=${from}&to=${to}&fmt=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const rows: Array<{ date: string; close: number }> = await res.json();
    if (!Array.isArray(rows) || rows.length < 2) return null;
    return rows.map((r) => ({ date: r.date, close: r.close }));
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
    const [chart, quote] = await Promise.all([
      yf.chart(upper, { period1: start, period2: end, interval: "1d" }, { validateResult: false }),
      yf.quote(upper, {}, { validateResult: false }).catch(() => null),
    ]);

    let data = (chart.quotes as Array<{ date: Date; close: number }>)
      .filter((row) => row.close != null)
      .map((row) => ({ date: row.date.toISOString().split("T")[0], close: row.close }));

    // Fall back to EODHD when Yahoo has no or sparse history
    if (data.length < 5) {
      const eodhdTicker = toEODHDSymbol(upper);
      const eodhd =
        (eodhdTicker ? await fetchFromEODHD(eodhdTicker, start, end) : null) ??
        (originalISIN   ? await fetchFromEODHD(`${originalISIN}.EUFUND`, start, end) : null);

      if (eodhd) {
        data = eodhd;
      } else {
        const hint = process.env.EODHD_API_KEY ? "" : " Add EODHD_API_KEY to .env.local for broader coverage.";
        return NextResponse.json(
          { error: `No price data found for "${symbol.toUpperCase()}".${hint}` },
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
        const eodhdName = await fetchNameFromEODHD(originalISIN ?? upper);
        name = eodhdName ?? name ?? upper;
      }
    }

    const currency = quote?.currency ?? inferCurrencyFromSuffix(upper);
    return NextResponse.json({ symbol: upper, name, earningsDate, data, currency });
  } catch {
    return NextResponse.json(
      { error: `Could not fetch data for "${upper}"` },
      { status: 404 }
    );
  }
}
