import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

const YAHOO_TO_EODHD: Record<string, string> = {
  "": "US", ".L": "LSE", ".DE": "XETRA", ".MU": "MU", ".ST": "STO",
  ".PA": "PA", ".AS": "AS", ".MI": "MIL", ".MC": "MC", ".SW": "SW",
  ".CO": "CO", ".HE": "HE", ".OL": "OSL", ".BR": "BR", ".VI": "VI",
  ".HK": "HK", ".T": "TSE", ".AX": "AU", ".SI": "SG", ".KL": "KLSE",
  ".NS": "NSE",
};

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/i;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  const date = req.nextUrl.searchParams.get("date")?.trim() ?? "";
  if (!symbol || !date) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  // Fetch a window ending on the target date to catch the nearest prior trading day
  const target = new Date(date + "T12:00:00Z");
  const from = new Date(target);
  from.setDate(from.getDate() - 7);
  const to = new Date(target);
  to.setDate(to.getDate() + 1);

  const upper = symbol.toUpperCase();

  // Try Yahoo first
  try {
    const chart = await yf.chart(upper, { period1: from, period2: to, interval: "1d" }, { validateResult: false });
    const pts = (chart.quotes as Array<{ date: Date; close: number }>)
      .filter((r) => r.close != null)
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // newest first
    if (pts.length > 0) {
      return NextResponse.json({ price: pts[0].close, date: pts[0].date.toISOString().split("T")[0] });
    }
  } catch { /* fall through */ }

  // Try EODHD
  const apiKey = process.env.EODHD_API_KEY;
  if (apiKey) {
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    const tryEODHD = async (sym: string) => {
      const url = `https://eodhd.com/api/eod/${encodeURIComponent(sym)}?api_token=${apiKey}&from=${fromStr}&to=${toStr}&fmt=json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const rows: Array<{ date: string; close: number }> = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const sorted = rows.sort((a, b) => b.date.localeCompare(a.date));
      return sorted[0];
    };

    try {
      const dotIdx = upper.lastIndexOf(".");
      const base = dotIdx >= 0 ? upper.slice(0, dotIdx) : upper;
      const suffix = dotIdx >= 0 ? upper.slice(dotIdx) : "";
      const exch = YAHOO_TO_EODHD[suffix];
      const eodhSym = exch != null ? `${base}.${exch}` : null;

      const row = (eodhSym ? await tryEODHD(eodhSym) : null)
        ?? (ISIN_RE.test(upper) ? await tryEODHD(`${upper}.EUFUND`) : null);
      if (row) return NextResponse.json({ price: row.close, date: row.date });
    } catch { /* fall through */ }
  }

  return NextResponse.json({ error: "Price not found" }, { status: 404 });
}
