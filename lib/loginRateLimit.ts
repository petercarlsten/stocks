const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export function isIPRateLimited(ip: string): boolean {
  cleanup();
  const entry = store.get(ip);
  if (!entry) return false;
  return Date.now() <= entry.resetAt && entry.count >= MAX_ATTEMPTS;
}

export function recordIPAttempt(ip: string): void {
  cleanup();
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
}

export function clearIPAttempts(ip: string): void {
  store.delete(ip);
}
