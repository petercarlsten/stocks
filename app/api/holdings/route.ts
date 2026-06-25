import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

export const revalidate = 3600;

function parsePct(val: unknown): number {
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && "raw" in val) return (val as { raw: number }).raw;
  return 0;
}

async function fetchHoldings(symbol: string): Promise<{ name: string; pct: number }[]> {
  const result = await yf.quoteSummary(symbol, { modules: ["topHoldings"] }, { validateResult: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[] = result?.topHoldings?.holdings ?? [];
  return raw
    .slice(0, 8)
    .map((h: { holdingName?: string; symbol?: string; holdingPercent?: unknown }) => ({
      name: h.holdingName ?? h.symbol ?? "Unknown",
      pct: parsePct(h.holdingPercent),
    }))
    .filter((h: { pct: number }) => h.pct > 0);
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
    return NextResponse.json({ holdings });
  } catch {
    return NextResponse.json({ holdings: [] });
  }
}
