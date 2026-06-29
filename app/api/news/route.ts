import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── Sentiment scoring ───────────────────────────────────────────────────────

const POSITIVE: [RegExp, number][] = [
  [/\b(beat|beats|beating)\s+(earnings|estimates?|expectations?|revenue|forecast)/i, 3],
  [/\b(record\s+(high|earnings|revenue|profit|quarter|year))\b/i, 3],
  [/\b(raised?\s+guidance|raises?\s+guidance|raised?\s+outlook)\b/i, 3],
  [/\bahead\s+of\s+(estimates?|expectations?|forecast|consensus)\b/i, 3],
  [/\b(initiates?|initiated)\s+.{0,30}\b(buy|outperform|overweight|strong\s+buy)\b/i, 3],
  [/\b(raises?|raised|lifts?|lifted|increases?|increased)\s+price\s+target\b/i, 3],
  [/\b(dividend\s+increase|dividend\s+hike|special\s+dividend)\b/i, 2],
  [/\b(share\s+buyback|stock\s+buyback|repurchase\s+program)\b/i, 2],
  [/\b(upgrade[sd]?|upgraded\s+to\s+(buy|outperform|overweight))\b/i, 2],
  [/\b(surges?|soars?|jumps?|spikes?|skyrockets?)\b/i, 2],
  [/\b(all[- ]time\s+high|52[- ]week\s+high)\b/i, 2],
  [/\b(strong\s+(results?|earnings?|revenue|demand|quarter))\b/i, 2],
  [/\b(bullish)\b/i, 2],
  [/\b(outperforms?|outperforming)\b/i, 2],
  [/\b(wins?\s+contract|awarded?\s+contract|new\s+contract)\b/i, 2],
  [/\b(free\s+cash\s+flow|positive\s+cash\s+flow)\b/i, 2],
  [/\b(market\s+share\s+(gain|growth|increase))\b/i, 2],
  [/\b(profit(able|ability)?|profitability)\b/i, 1],
  [/\b(growth|growing|grew)\b/i, 1],
  [/\b(gains?|gaining)\b/i, 1],
  [/\b(rises?|rising|rose)\b/i, 1],
  [/\b(rallies|rally|rallying)\b/i, 1],
  [/\b(exceeds?|exceeding|exceeded)\b/i, 1],
  [/\b(boosts?|boosting|boosted)\b/i, 1],
  [/\b(expansion|expands?|expanding)\b/i, 1],
  [/\b(deal|partnership|agreement|acqui(res?|sition))\b/i, 1],
  [/\b(approved?|approval|clears?|cleared)\b/i, 1],
  [/\b(launches?|launch|launched)\b/i, 1],
];

const NEGATIVE: [RegExp, number][] = [
  [/\b(missed?|misses?|missing)\s+(earnings|estimates?|expectations?|revenue|forecast)/i, 3],
  [/\b(lowered?\s+guidance|cuts?\s+guidance|lowered?\s+outlook|warned?\s+on\s+outlook)\b/i, 3],
  [/\b(bankruptcy|bankrupt|chapter\s+11|default|insolvency)\b/i, 3],
  [/\b(mass\s+layoff|layoffs?|lay\s+offs?|job\s+cuts?|reductions?\s+in\s+force)\b/i, 3],
  [/\bsec\s+(investigation|probe|charges?|enforcement|subpoena)\b/i, 3],
  [/\b(restate[sd]?|restatement)\s+(earnings|revenue|results|financials)\b/i, 3],
  [/\b(recall[sd]?|product\s+recall)\b/i, 2],
  [/\b(investigation|probe|fraud|lawsuit|class[- ]action|fine[sd]?|penalt(y|ies)|sanction)\b/i, 2],
  [/\b(downgrade[sd]?|downgraded\s+to\s+(sell|underperform|underweight))\b/i, 2],
  [/\b(cuts?|lowers?|reduces?)\s+price\s+target\b/i, 2],
  [/\b(credit\s+rating\s+(cut|downgrade)|downgrade[sd]?\s+credit)\b/i, 2],
  [/\b(plunges?|plunging|crashes?|crashing|slumps?|slumping|tumbles?|tumbling)\b/i, 2],
  [/\b(all[- ]time\s+low|52[- ]week\s+low)\b/i, 2],
  [/\b(weak(er)?\s+(results?|earnings?|revenue|demand|quarter))\b/i, 2],
  [/\b(disappoints?|disappointing|disappointed)\b/i, 2],
  [/\b(margin\s+(compression|squeeze|pressure))\b/i, 2],
  [/\b(cuts?\s+(dividend|forecast|outlook|jobs?))\b/i, 2],
  [/\b(bearish)\b/i, 2],
  [/\b(underperforms?|underperforming)\b/i, 2],
  [/\b(loss(es)?|net\s+loss)\b/i, 1],
  [/\b(declines?|declining|declined)\b/i, 1],
  [/\b(falls?|falling|fell)\b/i, 1],
  [/\b(drops?|dropping|dropped)\b/i, 1],
  [/\b(concern(s|ed)?|worry|worried|worrying)\b/i, 1],
  [/\b(risk[s]?|risky)\b/i, 1],
  [/\b(resigns?|resignation|ousted?|fired?)\b/i, 1],
  [/\b(warning[s]?|warns?)\b/i, 1],
];

// Negation words that can flip a pattern's sentiment
const NEGATION_RE = /\b(not|no|never|without|fail(?:s|ed|ing)?\s+to|unable\s+to|didn'?t|doesn'?t|won'?t|hasn'?t|haven'?t|isn'?t|aren'?t|wasn'?t|weren'?t|avoids?|averted?|denies?|denied)\b/i;

function scoreSegment(text: string): number {
  let score = 0;
  for (const [re, w] of POSITIVE) {
    const m = re.exec(text);
    if (m) {
      const before = text.slice(Math.max(0, m.index - 50), m.index);
      score += NEGATION_RE.test(before) ? -w : w;
    }
  }
  for (const [re, w] of NEGATIVE) {
    const m = re.exec(text);
    if (m) {
      const before = text.slice(Math.max(0, m.index - 50), m.index);
      score += NEGATION_RE.test(before) ? w : -w;
    }
  }
  return score;
}

function scoreSentiment(title: string, description: string | null): "positive" | "negative" | "neutral" {
  // Title carries 2x the weight of description
  const score = scoreSegment(title) * 2 + (description ? scoreSegment(description) : 0);
  if (score >= 2) return "positive";
  if (score <= -2) return "negative";
  return "neutral";
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/i;

const EXCH_SUFFIX: Record<string, string> = {
  US: "",    SS: ".ST", LN: ".L",  GR: ".MU", FP: ".PA",
  SM: ".MC", IT: ".MI", NA: ".AS", DC: ".CO", HO: ".HE",
  NO: ".OL", SW: ".SW", BB: ".BR", AV: ".VI",
  HK: ".HK", JP: ".T",  AU: ".AX", SG: ".SI", MK: ".KL", IN: ".NS",
};

const isinCache = new Map<string, string | null>();

async function resolveISIN(isin: string): Promise<string | null> {
  const key = isin.toUpperCase();
  if (isinCache.has(key)) return isinCache.get(key)!;
  try {
    const res = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ idType: "ID_ISIN", idValue: key }]),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) { isinCache.set(key, null); return null; }
    const json = await res.json();
    interface FIGIResult { ticker?: string; exchCode?: string; securityType?: string; }
    const data: FIGIResult[] = json[0]?.data ?? [];
    const FUND_TYPES = ["Common Stock", "ETP", "ETF", "Open-End Fund", "Closed-End Fund", "Mutual Fund", "Preferred Stock"];
    const match = data
      .filter((d) => d.ticker && d.exchCode && d.exchCode in EXCH_SUFFIX && FUND_TYPES.includes(d.securityType ?? ""))
      .sort((a, b) => (a.exchCode === "US" ? -1 : b.exchCode === "US" ? 1 : 0))[0];
    const ticker = match?.ticker ? `${match.ticker}${EXCH_SUFFIX[match.exchCode!]}` : null;
    isinCache.set(key, ticker);
    return ticker;
  } catch {
    isinCache.set(key, null);
    return null;
  }
}

const STOP_WORDS = new Set([
  "inc", "corp", "ltd", "llc", "the", "and", "co", "plc", "group",
  "holdings", "company", "companies", "international", "global", "trust",
  "berhad", "bhd", "sdn", "nv", "ag", "gmbh", "asa", "ab", "oyj", "sarl",
  "stock", "stocks", "share", "shares", "market", "markets", "fund", "funds",
  "index", "sector", "equity", "equities", "asset", "assets", "capital",
  "financial", "finance", "invest", "investor", "investors", "investment",
  "consumer", "growth", "value", "select", "management", "portfolio",
  "exchange", "trading", "trade", "price", "return", "returns",
  "bond", "bonds", "etf", "etfs", "reit",
  "vanguard", "ishares", "blackrock", "fidelity", "invesco", "spdr",
  "pimco", "schwab", "dimensional", "wisdomtree",
]);

function nameTerms(name: string | null): string[] {
  if (!name) return [];
  return [...new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
  )];
}

function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const ba = bigrams(a), bb = bigrams(b);
  let n = 0;
  for (const g of ba) if (bb.has(g)) n++;
  return (2 * n) / (ba.size + bb.size);
}

function isRelevant(text: string, terms: string[]): boolean {
  const words = new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  return terms.some((term) => {
    if (words.has(term)) return true;
    if (term.length >= 6) {
      return [...words].some((w) => bigramSimilarity(term, w) >= 0.8);
    }
    return false;
  });
}

// Internal type — _description carries pre-fetched text so we skip the og:description scrape
type RawItem = {
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
  thumbnail?: string | null;
  _description?: string | null;
};

// ─── Yahoo Finance RSS ───────────────────────────────────────────────────────

async function fetchRSSNews(symbol: string): Promise<RawItem[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/rss+xml, text/xml" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: RawItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = m[1];
      const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ??
                     block.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim() ?? "";
      const link  = (block.match(/<link>([\s\S]*?)<\/link>/) ??
                     block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/))?.[1]?.trim() ?? "";
      const pub   = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      const src   = (block.match(/<source[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/source>/) ??
                     block.match(/<source[^>]*>([\s\S]*?)<\/source>/))?.[1]?.trim() ?? "";
      const providerPublishTime = pub ? Math.floor(new Date(pub).getTime() / 1000) : 0;
      if (title && link) items.push({ title, link, publisher: src, providerPublishTime });
    }
    return items;
  } catch {
    return [];
  }
}

// ─── Yahoo Finance name search ───────────────────────────────────────────────

type YFSearchItem = {
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
  thumbnail?: { resolutions?: { url?: string }[] };
};

async function fetchSearchNews(query: string): Promise<RawItem[]> {
  try {
    const params = new URLSearchParams({ q: query, quotesCount: "0", newsCount: "40" });
    const res = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?${params}`, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: YFSearchItem[] = data?.news ?? data?.finance?.result?.[0]?.news ?? [];
    return raw.map((item) => ({
      title: item.title,
      publisher: item.publisher,
      link: item.link,
      providerPublishTime: item.providerPublishTime,
      thumbnail: item.thumbnail?.resolutions?.[0]?.url ?? null,
    }));
  } catch {
    return [];
  }
}

// ─── Finnhub ─────────────────────────────────────────────────────────────────

async function fetchFinnhubNews(symbol: string): Promise<RawItem[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];
  // Finnhub doesn't handle Yahoo-style mutual fund tickers (0P...) or exchange suffixes well
  if (/^0P/i.test(symbol)) return [];
  try {
    const to = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data: Array<{
      headline?: string; url?: string; source?: string;
      datetime?: number; image?: string; summary?: string;
    }> = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => item.headline && item.url)
      .map((item) => ({
        title: item.headline,
        link: item.url,
        publisher: item.source ?? "",
        providerPublishTime: item.datetime ?? 0,
        thumbnail: item.image || null,
        _description: item.summary || null,
      }));
  } catch {
    return [];
  }
}

// ─── Marketaux ───────────────────────────────────────────────────────────────

async function fetchMarketauxNews(symbol: string, name: string | null, terms: string[]): Promise<RawItem[]> {
  const apiKey = process.env.MARKETAUX_API_KEY;
  if (!apiKey) return [];
  try {
    const params = new URLSearchParams({
      api_token: apiKey,
      limit: "10",
      language: "en",
    });

    // Use symbol param for clean tickers (no exchange suffix); name search for funds / complex symbols
    const isCleanTicker = /^[A-Z0-9]{1,7}$/i.test(symbol) && !/^0P/i.test(symbol);
    if (isCleanTicker) {
      params.set("symbols", symbol);
    } else if (name) {
      // Use the first meaningful words of the fund name
      const searchTerms = nameTerms(name).slice(0, 3).join(" ");
      if (!searchTerms) return [];
      params.set("search", searchTerms);
    } else {
      return [];
    }

    const res = await fetch(`https://api.marketaux.com/v1/news/all?${params}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const articles: Array<{
      title?: string; url?: string; source?: string;
      published_at?: string; image_url?: string; description?: string;
    }> = json.data ?? [];

    return articles
      .filter((item) => item.title && item.url)
      .filter((item) => !terms.length || isRelevant(item.title ?? "", terms))
      .map((item) => ({
        title: item.title,
        link: item.url,
        publisher: item.source ?? "",
        providerPublishTime: item.published_at
          ? Math.floor(new Date(item.published_at).getTime() / 1000)
          : 0,
        thumbnail: item.image_url || null,
        _description: item.description || null,
      }));
  } catch {
    return [];
  }
}

// ─── og:description scraper (used only when source didn't provide a description) ──

const descCache = new Map<string, string | null>();

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function fetchDescription(link: string): Promise<string | null> {
  if (descCache.has(link)) return descCache.get(link)!;
  try {
    const res = await fetch(link, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) { descCache.set(link, null); return null; }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let html = "";
    try {
      while (html.length < 80_000) {
        const { value, done } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        if (html.includes("og:description")) break;
      }
    } finally {
      reader.cancel().catch(() => {});
    }

    const match =
      html.match(/property="og:description"\s+content="([^"]+)"/i) ??
      html.match(/content="([^"]+)"\s+property="og:description"/i) ??
      html.match(/name="description"\s+content="([^"]+)"/i) ??
      html.match(/content="([^"]+)"\s+name="description"/i);

    const desc = match ? decodeHtmlEntities(match[1].trim()) : null;
    descCache.set(link, desc);
    return desc;
  } catch {
    descCache.set(link, null);
    return null;
  }
}

// ─── Main per-stock fetcher ──────────────────────────────────────────────────

async function fetchNewsForStock(symbol: string, name: string | null) {
  // Resolve ISIN to a Yahoo/Finnhub-compatible ticker
  let effectiveSymbol = symbol;
  if (ISIN_RE.test(symbol)) {
    const resolved = await resolveISIN(symbol);
    if (resolved) effectiveSymbol = resolved;
  }

  const terms = nameTerms(name);
  const threeMonthsAgo = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;

  // Yahoo RSS + Finnhub in parallel — both are ticker-based and have generous limits
  const [rssItems, finnhubItems] = await Promise.all([
    fetchRSSNews(effectiveSymbol),
    fetchFinnhubNews(effectiveSymbol),
  ]);

  // Filter both by time and by company name terms to avoid cross-company bleed
  const filterItems = (items: RawItem[]) =>
    items.filter((item) => {
      if (item.providerPublishTime && item.providerPublishTime < threeMonthsAgo) return false;
      return !terms.length || isRelevant(item.title ?? "", terms);
    });

  const recentRss = filterItems(rssItems);
  const recentFinnhub = filterItems(finnhubItems);

  const primaryItems = [...recentRss, ...recentFinnhub];

  // Deduplicate early so we know the real count
  const seenPrimary = new Set<string>();
  const primaryDeduped = primaryItems.filter(({ link }) => {
    if (!link || seenPrimary.has(link)) return false;
    seenPrimary.add(link);
    return true;
  });

  // Fall back to Yahoo name search + Marketaux when primary sources are thin
  let fallbackItems: RawItem[] = [];
  if (primaryDeduped.length < 3) {
    const [searchItems, marketauxItems] = await Promise.all([
      (name || terms.length) ? fetchSearchNews(name ?? terms.join(" ")) : Promise.resolve([]),
      fetchMarketauxNews(effectiveSymbol, name, terms),
    ]);

    const searchFiltered = searchItems.filter((item) => {
      const t = item.providerPublishTime;
      if (t && t < threeMonthsAgo) return false;
      return terms.length ? isRelevant(item.title ?? "", terms) : false;
    });

    fallbackItems = [...searchFiltered, ...marketauxItems];
  }

  // Final merge — RSS first, then Finnhub, then fallbacks; cap at 6
  // seenPrimary already contains all primaryDeduped links, so only deduplicate fallbacks against it
  const seen = new Set(seenPrimary);
  const raw = [
    ...primaryDeduped,
    ...fallbackItems.filter(({ link }) => {
      if (!link || seen.has(link)) return false;
      seen.add(link);
      return true;
    }),
  ].slice(0, 6);

  // Only scrape og:description for items that didn't already provide one
  const descriptions = await Promise.all(
    raw.map((item) =>
      item._description !== undefined
        ? Promise.resolve(item._description)
        : fetchDescription(item.link ?? "")
    )
  );

  return raw.map((item, i) => {
    const title = item.title ?? "";
    const description = descriptions[i] ?? null;
    return {
      symbol,
      name: name ?? symbol,
      title,
      description,
      publisher: item.publisher ?? "",
      link: item.link ?? "",
      publishedAt: item.providerPublishTime ?? 0,
      thumbnail: item.thumbnail ?? null,
      sentiment: scoreSentiment(title, description),
    };
  });
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl;

  // Batch mode: ?symbols=AAPL,NET&names=Apple|Cloudflare
  const symbolsParam = url.searchParams.get("symbols");
  if (symbolsParam) {
    const symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const namesParam = url.searchParams.get("names") ?? "";
    const names = namesParam.split("|").map((s) => s.trim());

    try {
      const perStock = await Promise.all(
        symbols.map((sym, i) => fetchNewsForStock(sym, names[i] || null))
      );

      const seen = new Set<string>();
      const merged = perStock
        .flat()
        .filter(({ link }) => {
          if (seen.has(link)) return false;
          seen.add(link);
          return true;
        })
        .sort((a, b) => b.publishedAt - a.publishedAt);

      return NextResponse.json({ news: merged });
    } catch {
      return NextResponse.json({ news: [] });
    }
  }

  // General financial news mode: ?general=1
  if (url.searchParams.get("general")) {
    try {
      const [spx, economy] = await Promise.all([
        fetchRSSNews("%5EGSPC"),
        fetchSearchNews("financial markets economy"),
      ]);
      const seen = new Set<string>();
      const news = [...spx, ...economy]
        .filter(({ link }) => {
          if (!link || seen.has(link)) return false;
          seen.add(link);
          return true;
        })
        .slice(0, 10)
        .map((item) => {
          const title = item.title ?? "";
          return {
            title,
            publisher: item.publisher ?? "",
            link: item.link ?? "",
            publishedAt: item.providerPublishTime ?? 0,
            sentiment: scoreSentiment(title, null),
          };
        });
      return NextResponse.json({ news });
    } catch {
      return NextResponse.json({ news: [] });
    }
  }

  // Single stock mode: ?symbol=AAPL&name=Apple
  const symbol = url.searchParams.get("symbol");
  const name = url.searchParams.get("name");
  if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

  try {
    const news = await fetchNewsForStock(symbol, name);
    return NextResponse.json({ news });
  } catch {
    return NextResponse.json({ news: [] });
  }
}
