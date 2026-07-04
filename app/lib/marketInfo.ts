const SUFFIX_MARKET: Record<string, { code: string; name: string }> = {
  ".AS": { code: "AMS", name: "Euronext Amsterdam" },
  ".PA": { code: "PAR", name: "Euronext Paris" },
  ".DE": { code: "FRA", name: "Frankfurt Stock Exchange" },
  ".MU": { code: "FRA", name: "Frankfurt Stock Exchange" },
  ".L":  { code: "LON", name: "London Stock Exchange" },
  ".SW": { code: "SWX", name: "SIX Swiss Exchange" },
  ".CO": { code: "CPH", name: "Nasdaq Copenhagen" },
  ".HE": { code: "HEL", name: "Nasdaq Helsinki" },
  ".OL": { code: "OSL", name: "Oslo Stock Exchange" },
  ".ST": { code: "STO", name: "Nasdaq Stockholm" },
  ".BR": { code: "BRU", name: "Euronext Brussels" },
  ".VI": { code: "VIE", name: "Vienna Stock Exchange" },
  ".MI": { code: "MIL", name: "Borsa Italiana" },
  ".MC": { code: "MAD", name: "Bolsa de Madrid" },
  ".T":  { code: "TYO", name: "Tokyo Stock Exchange" },
  ".HK": { code: "HKG", name: "Hong Kong Stock Exchange" },
  ".KS": { code: "KRX", name: "Korea Exchange" },
  ".KQ": { code: "KRX", name: "Korea Exchange (KOSDAQ)" },
  ".NS": { code: "NSE", name: "National Stock Exchange of India" },
  ".BO": { code: "BSE", name: "Bombay Stock Exchange" },
  ".SI": { code: "SGX", name: "Singapore Exchange" },
  ".AX": { code: "ASX", name: "Australian Securities Exchange" },
  ".KL": { code: "KLS", name: "Bursa Malaysia" },
  ".TW": { code: "TWS", name: "Taiwan Stock Exchange" },
};

export function marketInfo(symbol: string): { code: string; name: string } {
  const dot = symbol.lastIndexOf(".");
  if (dot < 0) return { code: "US", name: "NYSE / Nasdaq" };
  const suffix = symbol.slice(dot);
  return SUFFIX_MARKET[suffix] ?? { code: suffix.slice(1).toUpperCase(), name: suffix.slice(1).toUpperCase() };
}
