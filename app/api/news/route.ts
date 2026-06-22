import { NextRequest, NextResponse } from "next/server";

const STOP_WORDS = new Set([
  // Corporate suffixes
  "inc", "corp", "ltd", "llc", "the", "and", "co", "plc", "group",
  "holdings", "company", "companies", "international", "global", "trust",
  "berhad", "bhd", "sdn", "nv", "ag", "gmbh", "asa", "ab", "oyj", "sarl",
  // Generic financial/market terms that appear in many unrelated headlines
  "stock", "stocks", "share", "shares", "market", "markets", "fund", "funds",
  "index", "sector", "equity", "equities", "asset", "assets", "capital",
  "financial", "finance", "invest", "investor", "investors", "investment",
  "consumer", "growth", "value", "select", "management", "portfolio",
  "exchange", "trading", "trade", "price", "return", "returns",
  // ETF/fund instrument words
  "bond", "bonds", "etf", "etfs", "reit",
  // Fund family names — too generic, match articles about unrelated products
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

type YFNewsItem = {
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
  thumbnail?: { resolutions?: { url?: string }[] };
};

// Ticker-specific RSS feed — most reliable source, results are already curated for the symbol
async function fetchRSSNews(symbol: string): Promise<YFNewsItem[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/rss+xml, text/xml" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: YFNewsItem[] = [];
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

// Name/keyword search — supplements RSS with additional articles, needs relevance filtering
async function fetchSearchNews(query: string): Promise<YFNewsItem[]> {
  try {
    const params = new URLSearchParams({ q: query, quotesCount: "0", newsCount: "40" });
    const res = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?${params}`, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.news ?? data?.finance?.result?.[0]?.news ?? [];
  } catch {
    return [];
  }
}

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

async function fetchNewsForStock(symbol: string, name: string | null) {
  const terms = nameTerms(name);
  const threeMonthsAgo = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;

  // RSS is symbol-specific and already curated — always fetch it
  const rssItems = await fetchRSSNews(symbol);
  const rssTrusted = rssItems.filter((item) => {
    const t = item.providerPublishTime;
    return !t || t >= threeMonthsAgo;
  });

  // Only hit the search API if RSS didn't return enough results
  let searchFiltered: YFNewsItem[] = [];
  if (rssTrusted.length < 3 && (name || terms.length)) {
    // Search by full company name — far more specific than a single extracted word
    const query = name ?? terms.join(" ");
    const searchItems = await fetchSearchNews(query);
    searchFiltered = searchItems.filter((item) => {
      const t = item.providerPublishTime;
      if (t && t < threeMonthsAgo) return false;
      // Must match at least one meaningful name term in the headline
      return terms.length ? isRelevant(item.title ?? "", terms) : false;
    });
  }

  // Merge, deduplicate, keep RSS items first (higher quality), cap at 5 per stock
  const seen = new Set<string>();
  const raw = [...rssTrusted, ...searchFiltered].filter(({ link }) => {
    if (!link || seen.has(link)) return false;
    seen.add(link);
    return true;
  }).slice(0, 5);

  const descriptions = await Promise.all(
    raw.map((item) => fetchDescription(item.link ?? ""))
  );

  return raw.map((item, i) => ({
    symbol,
    name: name ?? symbol,
    title: item.title ?? "",
    description: descriptions[i] ?? null,
    publisher: item.publisher ?? "",
    link: item.link ?? "",
    publishedAt: item.providerPublishTime ?? 0,
    thumbnail: item.thumbnail?.resolutions?.[0]?.url ?? null,
  }));
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;

  // Batch mode: ?symbols=AAPL,NET&names=Apple,Cloudflare
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
      // S&P 500 RSS gives broad market-moving news
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
        .map((item) => ({
          title: item.title ?? "",
          publisher: item.publisher ?? "",
          link: item.link ?? "",
          publishedAt: item.providerPublishTime ?? 0,
        }));
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
