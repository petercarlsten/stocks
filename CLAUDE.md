# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

## Architecture

Next.js App Router app (TypeScript + Tailwind). Key files:

- `app/page.tsx` — client component; manages stocks list, localStorage persistence, and hourly auto-refresh
- `app/components/StockChart.tsx` — recharts `LineChart` per stock with 3-month close price data
- `app/api/stocks/route.ts` — API route using `yahoo-finance2`; `?noName=1` skips the company name fetch (used during auto-refresh)

Stock data flow: page → `/api/stocks?symbol=X` → yahoo-finance2 → `{ symbol, name, data: [{date, close}] }`.
