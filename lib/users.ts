import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const DIR  = path.join(process.cwd(), "data");
const FILE = path.join(DIR, "users.json");

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}

export interface UserPreferences {
  currency?: string;
  theme?: "light" | "dark";
  funnyMode?: string;
  newsEnabled?: boolean;
  leaderboardEnabled?: boolean;
  topGainersEnabled?: boolean;
  language?: string;
  drawdownDate?: string;
  growthRate?: number;
  inflationRate?: number;
}

interface User {
  id: string;
  username: string;
  passwordHash?: string;
  provider?: "google";
  reportEmail?: string;
  reportCurrency?: string;
  preferences?: UserPreferences;
  pushSubscription?: object;
  createdAt?: string;
  lastLoginAt?: string;
  lastSeenAt?: string;
  lastSeenDevice?: string;
  timezone?: string;
  loginCount?: number;
  failedAttempts?: number;
  lockedUntil?: number | null;
}

function readUsers(): User[] {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeUsers(users: User[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
}

export function findByUsername(username: string): User | undefined {
  return readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export function findById(id: string): User | undefined {
  return readUsers().find((u) => u.id === id);
}

export async function createUser(username: string, password: string): Promise<User> {
  const users = readUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already taken");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user: User = { id: crypto.randomUUID(), username, passwordHash, createdAt: new Date().toISOString() };
  writeUsers([...users, user]);
  return user;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function findOrCreateGoogleUser(email: string): User {
  const users = readUsers();
  const existing = users.find((u) => u.username.toLowerCase() === email.toLowerCase());
  if (existing) return existing;
  const user: User = { id: crypto.randomUUID(), username: email, provider: "google", createdAt: new Date().toISOString() };
  writeUsers([...users, user]);
  return user;
}

export function recordLogin(username: string) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return;
  users[idx] = {
    ...users[idx],
    lastLoginAt: new Date().toISOString(),
    loginCount: (users[idx].loginCount ?? 0) + 1,
  };
  writeUsers(users);
}

export function getAllUsers(): User[] {
  return readUsers();
}

export function getReportEmail(username: string): string | null {
  return readUsers().find((u) => u.username === username)?.reportEmail ?? null;
}

export function setReportEmail(username: string, email: string) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) return;
  users[idx] = { ...users[idx], reportEmail: email || undefined };
  writeUsers(users);
}

export function parseDevice(ua: string): string {
  if (!ua) return "Unknown";
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua) && /Mobile/.test(ua)) return "Android Phone";
  if (/Android/.test(ua)) return "Android Tablet";
  if (/Windows/.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

export function updateLastSeen(username: string, ua?: string, timezone?: string) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return;
  const update: Partial<User> = { lastSeenAt: new Date().toISOString() };
  if (ua) update.lastSeenDevice = parseDevice(ua);
  if (timezone) update.timezone = timezone;
  users[idx] = { ...users[idx], ...update };
  writeUsers(users);
}

export function getReportCurrency(username: string): string {
  return readUsers().find((u) => u.username === username)?.reportCurrency ?? "USD";
}

export function setReportCurrency(username: string, currency: string) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) return;
  users[idx] = { ...users[idx], reportCurrency: currency || undefined };
  writeUsers(users);
}

export function getPreferences(username: string): UserPreferences {
  return readUsers().find((u) => u.username === username)?.preferences ?? {};
}

export function setPreferences(username: string, prefs: UserPreferences) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) return;
  users[idx] = { ...users[idx], preferences: { ...users[idx].preferences, ...prefs } };
  writeUsers(users);
}

export function getPushSubscription(username: string): object | null {
  return readUsers().find((u) => u.username === username)?.pushSubscription ?? null;
}

export function setPushSubscription(username: string, subscription: object | null) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) return;
  if (subscription === null) {
    const { pushSubscription: _, ...rest } = users[idx];
    users[idx] = rest as typeof users[number];
  } else {
    users[idx] = { ...users[idx], pushSubscription: subscription };
  }
  writeUsers(users);
}

export function getAllPushSubscriptions(): { username: string; subscription: object }[] {
  return readUsers()
    .filter((u) => u.pushSubscription)
    .map((u) => ({ username: u.username, subscription: u.pushSubscription! }));
}

const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function recordFailedLogin(username: string): void {
  const users = readUsers();
  const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return;
  const attempts = (users[idx].failedAttempts ?? 0) + 1;
  users[idx] = {
    ...users[idx],
    failedAttempts: attempts,
    lockedUntil: attempts >= MAX_FAILED ? Date.now() + LOCKOUT_MS : users[idx].lockedUntil ?? null,
  };
  writeUsers(users);
}

export function clearFailedLogins(username: string): void {
  const users = readUsers();
  const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return;
  users[idx] = { ...users[idx], failedAttempts: 0, lockedUntil: null };
  writeUsers(users);
}

export function isLockedOut(username: string): boolean {
  const user = readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user?.lockedUntil) return false;
  return Date.now() < user.lockedUntil;
}

export function isAdmin(username: string): boolean {
  return username.toLowerCase() === "peter.carlsten";
}

export function deleteUser(username: string) {
  const users = readUsers();
  writeUsers(users.filter((u) => u.username.toLowerCase() !== username.toLowerCase()));
  // Delete their stock data file if it exists
  const stockFile = path.join(DIR, "stocks", `${username}.json`);
  if (fs.existsSync(stockFile)) fs.unlinkSync(stockFile);
}
