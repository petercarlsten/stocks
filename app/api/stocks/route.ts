import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// yahoo-finance2 v3 uses a class-based API; bypass type mismatch with require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

// ─── Yahoo Finance v2 direct HTTP (bypasses library validation) ─────────────

async function fetchFromYahooV2(
  symbol: string,
  start: Date,
  end: Date
): Promise<{ date: string; close: number }[] | null> {
  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(end.getTime() / 1000);
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const timestamps: number[] = result.timestamp ?? [];
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
    const rows = timestamps
      .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().split("T")[0], close: closes[i] }))
      .filter((r) => r.close != null && !isNaN(r.close))
      .sort((a, b) => a.date.localeCompare(b.date));
    return rows.length >= 5 ? rows : null;
  } catch {
    return null;
  }
}

// ─── Stooq (free, no key, no rate limits) ───────────────────────────────────

const STOOQ_CACHE = new Map<string, { rows: { date: string; close: number }[]; cachedAt: number }>();

function toStooqSymbol(yahooSymbol: string): string {
  const lower = yahooSymbol.toLowerCase();
  return lower.includes(".") ? lower : `${lower}.us`;
}

async function fetchFromStooqSymbol(
  stooqSymbol: string,
  start: Date,
  end: Date
): Promise<{ date: string; close: number }[] | null> {
  const cacheKey = `stooq:${stooqSymbol}`;
  const cached = STOOQ_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.rows;

  const d1 = start.toISOString().split("T")[0].replace(/-/g, "");
  const d2 = end.toISOString().split("T")[0].replace(/-/g, "");
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&d1=${d1}&d2=${d2}&i=d`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    console.log(`[stooq] ${stooqSymbol}: ${text.slice(0, 120)}`);
    // "Brak danych" = Polish for "No data"; also catches HTML error pages
    if (!text || text.includes("Brak danych") || text.includes("No data") || text.includes("<html") || text.trim().length < 20) return null;

    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;

    // CSV header: Date,Open,High,Low,Close,Volume
    const rows = lines
      .slice(1)
      .map((line) => {
        const cols = line.split(",");
        const date = cols[0]?.trim();
        const close = parseFloat(cols[4]?.trim());
        return { date, close };
      })
      .filter((r) => r.date && !isNaN(r.close) && r.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (rows.length < 2) return null;
    STOOQ_CACHE.set(cacheKey, { rows, cachedAt: Date.now() });
    return rows;
  } catch {
    return null;
  }
}

async function fetchFromStooq(
  symbol: string,
  start: Date,
  end: Date
): Promise<{ date: string; close: number }[] | null> {
  const primary = toStooqSymbol(symbol);
  let result = await fetchFromStooqSymbol(primary, start, end);
  if (result) return result;

  // For Swedish .ST stocks, try stripping a leading 2-letter country prefix
  // e.g. SEBLAKE.ST → blake.st (some systems prepend the ISO country code)
  const dotIdx = symbol.lastIndexOf(".");
  const base = dotIdx >= 0 ? symbol.slice(0, dotIdx) : symbol;
  const suffix = dotIdx >= 0 ? symbol.slice(dotIdx).toLowerCase() : "";
  if (suffix === ".st" && base.length > 3 && /^[A-Z]{2}/.test(base)) {
    const stripped = base.slice(2).toLowerCase() + suffix;
    console.log(`[stooq] retrying without country prefix: ${stripped}`);
    result = await fetchFromStooqSymbol(stripped, start, end);
  }

  return result;
}

// ─── Alpha Vantage (25 req/day free, good European coverage) ────────────────

const AV_SUFFIX: Record<string, string> = {
  ".ST": "STO", ".L": "LON", ".DE": "FRA", ".MU": "FRA", ".PA": "PAR",
  ".AS": "AMS", ".MI": "MIL", ".MC": "MAD", ".CO": "CPH", ".HE": "HEL",
  ".OL": "OSL", ".SW": "SWX", ".HK": "HKG", ".T": "TYO", ".AX": "ASX",
};

const AV_CACHE = new Map<string, { rows: { date: string; close: number }[]; cachedAt: number }>();

async function fetchFromAlphaVantage(
  yahooSymbol: string,
  start: Date
): Promise<{ date: string; close: number }[] | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return null;

  const dotIdx = yahooSymbol.lastIndexOf(".");
  const base = dotIdx >= 0 ? yahooSymbol.slice(0, dotIdx) : yahooSymbol;
  const suffix = dotIdx >= 0 ? yahooSymbol.slice(dotIdx) : "";
  const avExch = AV_SUFFIX[suffix];
  const avSymbol = avExch ? `${base}.${avExch}` : base;

  const cacheKey = `av:${avSymbol}`;
  const cached = AV_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.rows;

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(avSymbol)}&outputsize=full&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const series = json["Time Series (Daily)"];
    if (!series) return null;
    const cutoff = start.toISOString().split("T")[0];
    const rows = Object.entries(series as Record<string, Record<string, string>>)
      .filter(([date]) => date >= cutoff)
      .map(([date, v]) => ({ date, close: parseFloat(v["4. close"]) }))
      .filter((r) => !isNaN(r.close))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (rows.length < 5) return null;
    AV_CACHE.set(cacheKey, { rows, cachedAt: Date.now() });
    return rows;
  } catch {
    return null;
  }
}

// ─── Twelve Data ────────────────────────────────────────────────────────────

const TD_CACHE = new Map<string, { rows: { date: string; close: number }[]; cachedAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function fetchFromTwelveData(
  symbol: string,
  start: Date,
  end: Date
): Promise<{ date: string; close: number }[] | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return null;

  const cacheKey = `td:${symbol}`;
  const cached = TD_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.rows;

  const from = start.toISOString().split("T")[0];
  const to   = end.toISOString().split("T")[0];
  const url  = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${from}&end_date=${to}&outputsize=260&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status === "error" || !Array.isArray(json.values)) return null;
    interface TDValue { datetime: string; close: string; }
    const rows = (json.values as TDValue[])
      .map((v) => ({ date: v.datetime, close: parseFloat(v.close) }))
      .filter((r) => !isNaN(r.close))
      .reverse(); // Twelve Data returns newest-first
    if (rows.length < 2) return null;
    TD_CACHE.set(cacheKey, { rows, cachedAt: Date.now() });
    return rows;
  } catch {
    return null;
  }
}

async function searchTwelveData(query: string): Promise<{ name: string | null; symbol: string | null }> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return { name: null, symbol: null };
  try {
    const res = await fetch(
      `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${apiKey}`
    );
    if (!res.ok) return { name: null, symbol: null };
    const json = await res.json();
    interface TDSymbol { instrument_name?: string; symbol?: string; }
    const data = json.data as TDSymbol[] | undefined;
    if (!Array.isArray(data) || data.length === 0) return { name: null, symbol: null };
    return { name: data[0]?.instrument_name ?? null, symbol: data[0]?.symbol ?? null };
  } catch {
    return { name: null, symbol: null };
  }
}

// ─── EODHD (fallback) ───────────────────────────────────────────────────────

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

const EODHD_CACHE = new Map<string, { rows: { date: string; close: number }[]; cachedAt: number }>();
// Store the timestamp when rate-limited (not a boolean) so it auto-resets after 24 h
let eohdRateLimitedAt = 0;
const EODHD_RATE_LIMIT_TTL = 24 * 60 * 60 * 1000;

async function fetchFromEODHD(
  eodhSymbol: string,
  start: Date,
  end: Date
): Promise<{ date: string; close: number }[] | null> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey || (eohdRateLimitedAt > 0 && Date.now() - eohdRateLimitedAt < EODHD_RATE_LIMIT_TTL)) return null;

  const cacheKey = `eod:${eodhSymbol}`;
  const cached = EODHD_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.rows;

  const from = start.toISOString().split("T")[0];
  const to   = end.toISOString().split("T")[0];
  const url  = `https://eodhd.com/api/eod/${encodeURIComponent(eodhSymbol)}?api_token=${apiKey}&from=${from}&to=${to}&fmt=json`;

  try {
    const res = await fetch(url);
    if (res.status === 402) { eohdRateLimitedAt = Date.now(); return null; }
    if (!res.ok) return null;
    const rows: Array<{ date: string; close: number }> = await res.json();
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const result = rows.map((r) => ({ date: r.date, close: r.close }));
    EODHD_CACHE.set(cacheKey, { rows: result, cachedAt: Date.now() });
    return result;
  } catch {
    return null;
  }
}

async function searchEODHD(query: string): Promise<{ name: string | null; isin: string | null }> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey || (eohdRateLimitedAt > 0 && Date.now() - eohdRateLimitedAt < EODHD_RATE_LIMIT_TTL)) return { name: null, isin: null };
  try {
    const res = await fetch(`https://eodhd.com/api/search/${encodeURIComponent(query)}?api_token=${apiKey}`);
    if (res.status === 402) { eohdRateLimitedAt = Date.now(); return { name: null, isin: null }; }
    if (!res.ok) return { name: null, isin: null };
    const rows: Array<{ Name?: string; ISIN?: string }> = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return { name: null, isin: null };
    const match = rows.find((r) => r.ISIN === query.toUpperCase()) ?? rows[0];
    return { name: match?.Name ?? null, isin: match?.ISIN ?? null };
  } catch {
    return { name: null, isin: null };
  }
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

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

// ─── Route handler ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const symbol = req.nextUrl.searchParams.get("symbol");
  const includeName = req.nextUrl.searchParams.get("noName") !== "1";
  const nameHint = req.nextUrl.searchParams.get("name") ?? undefined;

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  let upper = symbol.toUpperCase();
  let originalISIN: string | null = null;

  if (ISIN_RE.test(upper)) {
    originalISIN = upper;
    const resolved = await resolveISIN(upper);
    if (resolved) upper = resolved.toUpperCase();
  }

  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 13);

  try {
    const [chartResult, quote, earningsSummary] = await Promise.all([
      yf.chart(upper, { period1: start, period2: end, interval: "1d" }, { validateResult: false }).catch(() => null),
      yf.quote(upper, {}, { validateResult: false }).catch(() => null),
      yf.quoteSummary(upper, { modules: ["earningsHistory"] }, { validateResult: false }).catch(() => null),
    ]);

    let data = chartResult
      ? (chartResult.quotes as Array<{ date: Date; close: number }>)
          .filter((row) => row.close != null)
          .map((row) => ({ date: row.date.toISOString().split("T")[0], close: row.close }))
      : [];

    if (data.length < 5) {
      const debugSteps: string[] = [];
      debugSteps.push(`Yahoo quotes: ${data.length} (symbol="${upper}")`);

      let fallback: { date: string; close: number }[] | null = null;

      // ── Tier 1: Yahoo v2 direct HTTP (bypasses library validation) ───────
      fallback = await fetchFromYahooV2(upper, start, end);
      debugSteps.push(`YahooV2 "${upper}": ${fallback ? fallback.length + " rows" : "null"}`);

      // ── Tier 2: Stooq (free, unlimited) ──────────────────────────────────
      if (!fallback) fallback = await fetchFromStooq(upper, start, end);
      debugSteps.push(`Stooq "${toStooqSymbol(upper)}": ${fallback ? fallback.length + " rows" : "null"}`);

      // ── Tier 3: Alpha Vantage ─────────────────────────────────────────────
      if (!fallback) fallback = await fetchFromAlphaVantage(upper, start);
      debugSteps.push(`AlphaVantage "${upper}": ${fallback ? fallback.length + " rows" : "null"}`);

      // ── Tier 4: Twelve Data ──────────────────────────────────────────────
      if (!fallback) fallback = await fetchFromTwelveData(upper, start, end);
      debugSteps.push(`TwelveData "${upper}": ${fallback ? fallback.length + " rows" : "null"}`);

      // ── Tier 5: EODHD (exchange ticker + EUFUND for ISINs) ───────────────
      if (!fallback) {
        const eodhdTicker = toEODHDSymbol(upper);
        if (eodhdTicker) {
          fallback = await fetchFromEODHD(eodhdTicker, start, end);
          debugSteps.push(`EODHD "${eodhdTicker}": ${fallback ? fallback.length + " rows" : "null"}`);
        }
      }

      // For ISINs, try EODHD EUFUND before falling back to Twelve Data ISIN —
      // EODHD is the most reliable source for Luxembourg/European UCITS funds.
      if (!fallback && originalISIN) {
        fallback = await fetchFromEODHD(`${originalISIN}.EUFUND`, start, end);
        debugSteps.push(`EODHD "${originalISIN}.EUFUND": ${fallback ? fallback.length + " rows" : "null"}`);
      }

      if (!fallback && originalISIN) {
        // Twelve Data accepts ISINs natively
        fallback = await fetchFromTwelveData(originalISIN, start, end);
        debugSteps.push(`TwelveData ISIN "${originalISIN}": ${fallback ? fallback.length + " rows" : "null"}`);
      }

      // ── Tier 3: OpenFIGI name → search both providers ───────────────────
      if (!fallback && !originalISIN) {
        const YAHOO_TO_OPENFIGI: Record<string, string> = {
          ".MU": "GR", ".DE": "GR", ".F": "GR", ".BE": "GR", ".HA": "GR",
          ".HM": "GR", ".SG": "GR", ".DU": "GR",
          ".L": "LN", ".PA": "FP", ".AS": "NA", ".MI": "IT", ".MC": "SM",
          ".ST": "SS", ".CO": "DC", ".HE": "HO", ".OL": "NO", ".SW": "SW",
          ".BR": "BB", ".VI": "AV",
        };
        const dotIdx = upper.lastIndexOf(".");
        const base         = dotIdx >= 0 ? upper.slice(0, dotIdx) : upper;
        const suffix       = dotIdx >= 0 ? upper.slice(dotIdx) : "";
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

        const searchTerms = [base, figiName, nameHint].filter(Boolean) as string[];

        // Try Stooq with base ticker directly
        if (!fallback) {
          fallback = await fetchFromStooq(upper, start, end);
          debugSteps.push(`Stooq search "${toStooqSymbol(upper)}": ${fallback ? fallback.length + " rows" : "null"}`);
        }

        // Try Twelve Data search first
        for (const term of searchTerms) {
          if (fallback) break;
          const { symbol: tdSymbol } = await searchTwelveData(term);
          debugSteps.push(`TwelveData search "${term.slice(0, 60)}": symbol=${tdSymbol}`);
          if (tdSymbol) {
            fallback = await fetchFromTwelveData(tdSymbol, start, end);
            debugSteps.push(`TwelveData "${tdSymbol}": ${fallback ? fallback.length + " rows" : "null"}`);
          }
        }

        // Then try EODHD search
        if (!fallback) {
          let recoveredISIN: string | null = null;
          for (const term of searchTerms) {
            if (recoveredISIN) break;
            const { isin } = await searchEODHD(term);
            debugSteps.push(`EODHD search "${term.slice(0, 60)}": isin=${isin}`);
            if (isin) recoveredISIN = isin;
          }
          if (recoveredISIN) {
            originalISIN = recoveredISIN;
            fallback = await fetchFromEODHD(`${recoveredISIN}.EUFUND`, start, end);
            debugSteps.push(`EODHD "${recoveredISIN}.EUFUND": ${fallback ? fallback.length + " rows" : "null"}`);
          }
        }
      }

      if (fallback) {
        data = fallback;
      } else {
        const detail = debugSteps.join(" → ");
        console.error(`[stocks] No data for "${symbol}": ${detail}`);
        const hints: string[] = [];
        if (!process.env.TWELVE_DATA_API_KEY) hints.push("Add TWELVE_DATA_API_KEY");
        if (!process.env.ALPHA_VANTAGE_API_KEY) hints.push("Add ALPHA_VANTAGE_API_KEY");
        if (!process.env.EODHD_API_KEY) hints.push("Add EODHD_API_KEY");
        if (eohdRateLimitedAt > 0 && Date.now() - eohdRateLimitedAt < EODHD_RATE_LIMIT_TTL) hints.push("EODHD daily limit reached — resets tomorrow");
        return NextResponse.json(
          { error: `No price data found for "${symbol.toUpperCase()}".${hints.length ? " " + hints.join(". ") + "." : ""}`, debug: detail },
          { status: 404 }
        );
      }
    }

    let earningsDate: string | null = null;
    const ts = quote?.earningsTimestampEnd ?? quote?.earningsTimestamp ?? quote?.earningsTimestampStart;
    if (ts) {
      const d = ts instanceof Date ? ts : new Date((ts as number) * 1000);
      if (!isNaN(d.getTime())) earningsDate = d.toISOString().split("T")[0];
    }

    let name: string | null = null;
    if (includeName) {
      name = quote?.longName ?? quote?.shortName ?? null;
      if (!name) {
        const results = await yf.search(upper).catch(() => null);
        type SearchQuote = { symbol?: string; longname?: string; shortname?: string; longName?: string; shortName?: string };
        const match = results?.quotes?.find(
          (q: SearchQuote) => q.symbol === upper
        ) as SearchQuote | undefined;
        name = match?.longname ?? match?.longName ?? match?.shortname ?? match?.shortName ?? null;
      }
      // If name looks abbreviated (e.g. "FR.TEMP.INV.FDS"), try richer sources
      const looksAbbreviated = !name || /[A-Z]\.[A-Z]/.test(name);
      if (looksAbbreviated) {
        const { name: tdName } = await searchTwelveData(originalISIN ?? upper);
        if (tdName) {
          name = tdName;
        } else {
          const { name: eodhdName } = await searchEODHD(originalISIN ?? upper);
          name = eodhdName ?? name ?? upper;
        }
      }
    }

    // For non-US exchange tickers (e.g. .SI, .ST, .L), the suffix tells us the
    // trading currency. Yahoo's quote.currency often returns the fund's underlying
    // reporting currency (e.g. "USD" for a SGD-listed US fund), which is wrong —
    // prices in the data are always in the local exchange currency.
    const suffixCurrency = inferCurrencyFromSuffix(upper);
    const currency = suffixCurrency !== "USD" ? suffixCurrency : (quote?.currency ?? "USD");
    const marketState = (quote?.marketState as string | undefined) ?? null;
    const exchangeTimezoneName = (quote?.exchangeTimezoneName as string | undefined) ?? null;
    const quoteType = (quote?.quoteType as string | undefined) ?? null;
    const navTimestamp: number | null = (() => {
      const rmt = quote?.regularMarketTime;
      if (!rmt) return null;
      const d = rmt instanceof Date ? rmt : new Date((rmt as number) * 1000);
      return isNaN(d.getTime()) ? null : d.getTime();
    })();
    type EarningsHistoryEntry = { quarter?: Date; epsActual?: number; epsEstimate?: number; surprisePercent?: number; currency?: string };
    const earningsHistory: EarningsHistoryEntry[] = earningsSummary?.earningsHistory?.history ?? [];
    const today = new Date().toISOString().split("T")[0];
    const pastEntries = earningsHistory
      .filter((e) => e.quarter && e.quarter.toISOString().split("T")[0] <= today && e.epsActual != null)
      .sort((a, b) => (b.quarter!.getTime() - a.quarter!.getTime()));
    const latest = pastEntries[0] ?? null;
    const earningsResult = latest ? {
      epsActual: latest.epsActual ?? null,
      epsEstimate: latest.epsEstimate ?? null,
      surprisePercent: latest.surprisePercent ?? null,
      currency: latest.currency ?? currency,
    } : null;

    const responseSymbol = originalISIN ?? upper;
    return NextResponse.json({ symbol: responseSymbol, name, earningsDate, data, currency, marketState, exchangeTimezoneName, quoteType, navTimestamp, earningsResult });
  } catch {
    return NextResponse.json(
      { error: `Could not fetch data for "${upper}"` },
      { status: 404 }
    );
  }
}
