# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

## Architecture

Next.js App Router app (TypeScript + Tailwind). Two main pieces:

- `app/page.tsx` — client component; manages the list of up to 6 stocks, input, and lays out charts in a responsive CSS grid
- `app/components/StockChart.tsx` — recharts `LineChart` per stock with 3-month close price data
- `app/api/stocks/route.ts` — API route; calls `yahoo-finance2` to fetch 3-month daily historical prices for a given `?symbol=` query param

Stock data flows: page → `/api/stocks?symbol=X` → yahoo-finance2 → back as `{ symbol, data: [{date, close}] }`.
