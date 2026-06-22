import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

export const revalidate = 86400; // cache 24h — sector rarely changes

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
  if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

  try {
    const result = await yf.quoteSummary(symbol, { modules: ["summaryProfile", "price"] }, { validateResult: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = (result as any)?.summaryProfile;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const price = (result as any)?.price;

    const quoteType: string = price?.quoteType ?? "EQUITY";
    let sector: string | null = profile?.sector ?? null;

    if (!sector) {
      if (quoteType === "ETF") sector = "ETF";
      else if (quoteType === "MUTUALFUND") sector = "Fund";
      else if (quoteType === "CRYPTOCURRENCY") sector = "Crypto";
      else sector = "Other";
    }

    return NextResponse.json({ symbol, sector });
  } catch {
    return NextResponse.json({ symbol, sector: "Other" });
  }
}
