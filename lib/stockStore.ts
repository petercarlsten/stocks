import fs from "fs";
import path from "path";
import { encryptJSON, decryptJSON } from "./encrypt";

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

function decryptEntry(s: StockEntry): Record<string, unknown> {
  if (s.purchases_enc) {
    const { purchases_enc, ...rest } = s;
    try {
      return { ...rest, purchases: decryptJSON(purchases_enc) };
    } catch {
      // Decryption failed (wrong key or corrupt data) — return without purchases
      return rest;
    }
  }
  return s;
}

function encryptEntry(s: StockEntry): Record<string, unknown> {
  if (!s.purchases) return s;
  const { purchases, ...rest } = s;
  return { ...rest, purchases_enc: encryptJSON(purchases) };
}

export function getUserStocks(username: string): unknown[] {
  ensureDir();
  try {
    const raw: StockEntry[] = JSON.parse(fs.readFileSync(filePath(username), "utf-8"));
    const decrypted = raw.map(decryptEntry);

    // Auto-migrate: if any entry still has plaintext purchases, re-save encrypted
    if (raw.some((s) => s.purchases && !s.purchases_enc)) {
      try {
        fs.writeFileSync(filePath(username), JSON.stringify(raw.map(encryptEntry), null, 2));
      } catch {
        // Non-fatal — will retry next load
      }
    }

    return decrypted;
  } catch {
    return [];
  }
}

export function saveUserStocks(username: string, stocks: unknown[]) {
  ensureDir();
  const encrypted = (stocks as StockEntry[]).map(encryptEntry);
  fs.writeFileSync(filePath(username), JSON.stringify(encrypted, null, 2));
}
