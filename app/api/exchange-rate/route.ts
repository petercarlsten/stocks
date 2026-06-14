import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const currency = req.nextUrl.searchParams.get("currency")?.toUpperCase().trim();
  if (!currency || currency === "USD") return NextResponse.json({ rate: 1 });

  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  const data = await res.json();

  const rate = data.rates?.[currency];
  if (!rate) return NextResponse.json({ error: `Unknown currency: ${currency}` }, { status: 404 });

  return NextResponse.json({ rate });
}
