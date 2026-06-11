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

export function getUserStocks(username: string): unknown[] {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(filePath(username), "utf-8"));
  } catch {
    return [];
  }
}

export function saveUserStocks(username: string, stocks: unknown[]) {
  ensureDir();
  fs.writeFileSync(filePath(username), JSON.stringify(stocks, null, 2));
}
