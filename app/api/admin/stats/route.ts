import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllUsers, isAdmin } from "@/lib/users";
import { getUserStocks } from "@/lib/stockStore";

export async function GET() {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name ?? null;
  if (!username || !isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = getAllUsers();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const activeDay = users.filter((u) => u.lastSeenAt && now - new Date(u.lastSeenAt).getTime() < day).length;
  const active7d = users.filter((u) => u.lastSeenAt && now - new Date(u.lastSeenAt).getTime() < 7 * day).length;
  const active30d = users.filter((u) => u.lastSeenAt && now - new Date(u.lastSeenAt).getTime() < 30 * day).length;
  const newThisMonth = users.filter((u) => {
    if (!u.createdAt) return false;
    const d = new Date(u.createdAt);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  }).length;
  const totalLogins = users.reduce((sum, u) => sum + (u.loginCount ?? 0), 0);
  const withPush = users.filter((u) => u.pushSubscription != null).length;

  const stockCounts = users.map((u) => {
    try { return (getUserStocks(u.username) as unknown[]).length; } catch { return 0; }
  });
  const totalStocks = stockCounts.reduce((a, b) => a + b, 0);
  const avgStocks = users.length > 0 ? (totalStocks / users.length).toFixed(1) : "0";
  const maxStocks = Math.max(0, ...stockCounts);

  const mem = process.memoryUsage();

  return NextResponse.json({
    totalUsers: users.length,
    activeDay,
    active7d,
    active30d,
    newThisMonth,
    totalLogins,
    withPush,
    totalStocks,
    avgStocks,
    maxStocks,
    memoryMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    uptimeSeconds: Math.round(process.uptime()),
  });
}
