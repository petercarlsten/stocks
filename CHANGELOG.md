# Changelog

## [0.9.1] – 2026-07-04
### Added
- Total portfolio performance YTD chart with Y-axis value labels (compact K/M notation)
- Exchange badge per stock card (e.g. STO, LON, US) with full exchange name on hover/tap
- Your Top performers since purchased panel — 3-column desktop layout, individual green/red border per entry
- Market Top Gainers expanded to 9 entries in 3-column desktop layout
- Region toggles (AMER/EMEA/APAC) moved from settings into the Market Top Gainers header
- Password recovery flow: email required on registration, forgot-password and reset-password pages
- Email column added to admin panel user table

### Changed
- Renamed portfolio chart label to "Total portfolio performance YTD"
- Renamed "Your Top Gainers since purchased" to "Your Top performers since purchased"
- Top performers and Market Top Gainers moved below the ticker search on desktop

### Fixed
- Page scroll no longer blocked by portfolio chart on mobile
- Drag-to-reorder works on mobile (switched to TouchSensor with press-delay)
- Exchange tooltip stays open on mobile tap (pointerType guard prevents immediate dismissal)
- Password reset email: added plain-text alternative and personalised subject to improve deliverability

## [0.9.0] – 2026-07-04
### Fixed
- Market exchange tooltips (TYO, KRX, etc.) now show on hover on desktop and tap on mobile
- Negative performers removed from Market Top Gainers — only positive gainers shown

## [0.8.0] – 2026-06-15
### Added
- Market Top Gainers expanded to include European (EMEA) and Asian (APAC) blue chips
- Company names shown as primary text in top gainers; ticker shown as tooltip
- Exchange label per stock (AMS, TYO, KRX, etc.) with full name on hover/tap
- AMER / EMEA / APAC region filter in settings — independently toggleable, all selected by default
- Tooltips for market labels work on mobile via tap popovers (replaced `title` attributes)

### Fixed
- Yahoo Finance rate limiting resolved by batching top gainers requests (15 at a time)
- API response cached for 1 hour to reduce repeated fetching

## [0.7.0] – 2026-06-10
### Added
- 1-year portfolio overview chart showing total holdings value back-cast over 12 months
- Chart period selector in settings: 1M / 3M / 6M / 12M (default 3 months)
- Dark theme: chart header, value, and tooltip text brightened for legibility

### Removed
- 1-year gain figure from portfolio summary header (replaced by the overview chart)

## [0.6.0] – 2026-05-20
### Added
- Dark / Light theme toggle in settings
- "Funny things" toggle (wolf GIF and other easter eggs)
- Stock news widget toggle in settings
- Settings panel reorganised with a Widgets section

## [0.5.0] – 2026-05-01
### Added
- Full ISIN fund support (e.g. LU0672654240): resolves to real ticker via Yahoo Finance search
- "Fund priced today" badge now shows correctly for MUTUALFUND quote types
- Purchase price history lookup works for ISIN-resolved funds
- Cross-device sync: local-only stocks pushed to server on load

### Fixed
- iOS Safari autofill no longer prompts for saved password on the ticker search input

## [0.4.0] – 2026-04-10
### Added
- Autocomplete search for tickers, ISINs, and company names
- Search spinner and stale-result prevention
- 30-day and 90-day portfolio value change shown in summary banner
- Maximum stocks per portfolio increased from 6 to 9

## [0.3.0] – 2026-03-15
### Added
- Username / password authentication with account creation
- Per-user stock configurations stored server-side
- Shares owned input per stock card
- Portfolio value displayed per card and as a total
- Drag-to-reorder stock chart cards
- "Your Top Gainers since purchased" leaderboard widget

## [0.2.0] – 2026-02-20
### Added
- Earnings call dates shown on each stock card (next and most recent)
- Market Top Gainers widget (US stocks, 3-month gain)
- Monthly budget calculator — projects how long investments last at a given spend rate

## [0.1.0] – 2026-01-01
### Added
- Initial release: Next.js app with per-stock 3-month close price charts powered by Yahoo Finance
- Multi-language support: English, Swedish, German, French
- Currency conversion using live exchange rates
- Custom favicon and browser metadata
