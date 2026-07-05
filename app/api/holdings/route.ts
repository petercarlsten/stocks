import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

export const revalidate = 3600;

const SECTOR_LABELS: Record<string, string> = {
  realestate: "Real Estate", consumer_cyclical: "Consumer Cyclical", basic_materials: "Basic Materials",
  consumer_defensive: "Consumer Defensive", technology: "Technology",
  communication_services: "Communication Services", financial_services: "Financial Services",
  utilities: "Utilities", industrials: "Industrials", energy: "Energy", healthcare: "Healthcare",
};

function parsePct(val: unknown): number {
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && "raw" in val) return (val as { raw: number }).raw;
  return 0;
}

async function fetchHoldings(symbol: string): Promise<{ name: string; pct: number; isSectors?: boolean }[]> {
  const result = await yf.quoteSummary(symbol, { modules: ["topHoldings"] }, { validateResult: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[] = result?.topHoldings?.holdings ?? [];
  const holdings = raw
    .slice(0, 8)
    .map((h: { holdingName?: string; symbol?: string; holdingPercent?: unknown }) => ({
      name: h.holdingName ?? h.symbol ?? "Unknown",
      pct: parsePct(h.holdingPercent),
    }))
    .filter((h: { pct: number }) => h.pct > 0);

  if (holdings.length > 0) return holdings;

  // Fall back to sector weightings when individual holdings aren't available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sectors: any[] = result?.topHoldings?.sectorWeightings ?? [];
  const sectorRows = sectors
    .flatMap((s) => Object.entries(s).map(([key, val]) => ({ name: SECTOR_LABELS[key] ?? key, pct: val as number })))
    .filter((s) => s.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8)
    .map((s) => ({ ...s, isSectors: true }));

  return sectorRows;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const symbolParam = req.nextUrl.searchParams.get("symbol")?.trim();
  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!symbolParam) return NextResponse.json({ holdings: [] });
  let symbol: string = symbolParam;

  // For EUFUND symbols, resolve via name search → Yahoo 0P/ETF ticker
  if (symbol.includes(".EUFUND")) {
    // Clean EODHD fund names: strip "FTIF - " prefix, remove parentheses
    const cleaned = name
      .replace(/^[A-Z]+\s*-\s*/i, "")   // strip fund family prefix like "FTIF - "
      .replace(/[()]/g, "")              // remove parentheses
      .trim();
    const query = cleaned || symbol.split(".")[0];
    try {
      const search = await yf.search(query, {}, { validateResult: false } as never);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quote = (search?.quotes ?? []).find((q: any) =>
        q.symbol && (q.quoteType === "MUTUALFUND" || q.quoteType === "ETF")
      );
      if (!quote) return NextResponse.json({ holdings: [] });
      symbol = quote.symbol;
    } catch {
      return NextResponse.json({ holdings: [] });
    }
  }

  try {
    const holdings = await fetchHoldings(symbol);
    const isSectors = holdings.length > 0 && holdings[0].isSectors === true;
    return NextResponse.json({ holdings: holdings.map((h) => ({ name: h.name, pct: h.pct })), isSectors });
  } catch {
    return NextResponse.json({ holdings: [] });
  }
}
