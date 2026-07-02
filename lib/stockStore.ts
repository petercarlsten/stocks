import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data", "stocks");

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}

function filePath(username: string) {
  const safe = username.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(DIR, `${safe}.json`);
}

type StockEntry = Record<string, unknown> & {
  purchases?: unknown[];
  purchases_enc?: string;
};

// Migrate old encrypted purchases to plaintext. Requires ENCRYPTION_KEY if
// the file still has encrypted blobs; silently drops purchases if key is missing.
function migrateEntry(s: StockEntry): Record<string, unknown> {
  if (!s.purchases_enc) return s;
  const { purchases_enc, ...rest } = s;
  try {
    const { decryptJSON } = require("./encrypt");
    return { ...rest, purchases: decryptJSON(purchases_enc) };
  } catch {
    return rest;
  }
}

export function getUserStocks(username: string): unknown[] {
  ensureDir();
  try {
    const raw: StockEntry[] = JSON.parse(fs.readFileSync(filePath(username), "utf-8"));
    const migrated = raw.map(migrateEntry);

    // Re-save as plain JSON if any entry was still encrypted
    if (raw.some((s) => s.purchases_enc)) {
      try {
        fs.writeFileSync(filePath(username), JSON.stringify(migrated, null, 2));
      } catch {
        // Non-fatal
      }
    }

    return migrated;
  } catch {
    return [];
  }
}

export function saveUserStocks(username: string, stocks: unknown[]) {
  ensureDir();
  fs.writeFileSync(filePath(username), JSON.stringify(stocks, null, 2));
}
