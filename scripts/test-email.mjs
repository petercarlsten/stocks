// Quick test: build and send report for dev user to peter.carlsten@me.com
import { readFileSync } from "fs";
import { join } from "path";

const RESEND_API_KEY = "re_RTnBPMsE_Psfr3b3hZwytWDap6Sr7s19n";
const TO = "peter.carlsten@me.com";

const stocks = JSON.parse(readFileSync(join(process.cwd(), "data/stocks/dev.json"), "utf-8"));

const now = new Date();
const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30);
const cutoff30Str = cutoff30.toISOString().split("T")[0];
const month = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

function fmt(v, c) {
  return c + " " + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(p) {
  if (p === null) return "—";
  return (p >= 0 ? "+" : "") + p.toFixed(2) + "%";
}
function pctColor(p) {
  if (p === null) return "#6b7280";
  return p >= 0 ? "#16a34a" : "#ef4444";
}

// Build reports from stored data
const reports = stocks.map((s) => {
  const data = s.data ?? [];
  const current = data[data.length - 1]?.close ?? 0;
  const past30 = data.filter(d => d.date <= cutoff30Str);
  const price30d = past30.length > 0 ? past30[past30.length - 1].close : null;
  const change30d = price30d && price30d > 0 ? ((current - price30d) / price30d) * 100 : null;
  const totalShares = (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0);
  const positionValue = totalShares > 0 && current > 0 ? totalShares * current : null;
  console.log(` ${s.symbol}: ${current} ${s.currency ?? "USD"} | 30d: ${fmtPct(change30d)}`);
  return { symbol: s.symbol, name: s.name, currentPrice: current, change30d, positionValue, currency: s.currency ?? "USD" };
}).sort((a, b) => (b.change30d ?? -Infinity) - (a.change30d ?? -Infinity));

// Fetch exchange rates for USD total
let totalUSD = 0, totalUSD30d = 0, has30d = false;
try {
  const ratesRes = await fetch("https://open.er-api.com/v6/latest/USD");
  const ratesData = await ratesRes.json();
  const rates = { USD: 1, ...ratesData.rates };
  for (const r of reports) {
    const toUSD = 1 / (rates[r.currency] ?? 1);
    const shares = (stocks.find(s => s.symbol === r.symbol)?.purchases ?? []).reduce((sum, p) => sum + p.shares, 0);
    if (shares > 0 && r.currentPrice > 0) {
      totalUSD += shares * r.currentPrice * toUSD;
      if (r.change30d !== null) {
        const price30d = r.currentPrice / (1 + r.change30d / 100);
        totalUSD30d += shares * price30d * toUSD;
        has30d = true;
      }
    }
  }
} catch {}

const totalChange30dPct = has30d && totalUSD30d > 0 ? ((totalUSD - totalUSD30d) / totalUSD30d) * 100 : null;
const totalEarnings30dUSD = has30d ? totalUSD - totalUSD30d : null;

// Build HTML
const stockRows = reports.map(s => `
  <tr>
    <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px">${s.name}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:right;color:#374151;font-size:13px;white-space:nowrap">${s.currentPrice > 0 ? fmt(s.currentPrice, s.currency) : "—"}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;color:${pctColor(s.change30d)};font-size:13px">${fmtPct(s.change30d)}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:right;color:#374151;font-size:13px;white-space:nowrap">${s.positionValue !== null ? fmt(s.positionValue, s.currency) : "—"}</td>
  </tr>`).join("");

const summaryBlock = totalUSD > 0 ? `
  <div style="background:#f9fafb;border-radius:12px;padding:20px 24px;margin-bottom:28px;border:1px solid #f3f4f6">
    <table style="width:100%;border-collapse:collapse"><tr>
      <td style="vertical-align:top">
        <p style="margin:0 0 4px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Portfolio value</p>
        <p style="margin:0;color:#111827;font-size:26px;font-weight:800">${fmt(totalUSD, "USD")}</p>
      </td>
      ${totalChange30dPct !== null ? `<td style="text-align:right;vertical-align:top">
        <p style="margin:0 0 4px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">30-day change</p>
        <p style="margin:0;font-size:22px;font-weight:800;color:${pctColor(totalChange30dPct)}">${fmtPct(totalChange30dPct)}</p>
        ${totalEarnings30dUSD !== null ? `<p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${pctColor(totalEarnings30dUSD)}">${totalEarnings30dUSD >= 0 ? "+" : ""}${fmt(totalEarnings30dUSD, "USD")}</p>` : ""}
      </td>` : ""}
    </tr></table>
  </div>` : "";

const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:620px;margin:40px auto 60px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#6366f1 0%,#a855f7 50%,#10b981 100%);padding:28px 32px 24px">
      <table style="width:100%;border-collapse:collapse"><tr>
        <td style="vertical-align:middle">
          <div style="background:rgba(255,255,255,0.18);border-radius:12px;padding:10px;display:inline-block">
            <svg width="28" height="20" viewBox="0 0 56 36" fill="none">
              <polyline points="2,30 12,22 22,26 34,10 46,6 54,2" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polygon points="2,30 12,22 22,26 34,10 46,6 54,2 54,34 2,34" fill="white" opacity="0.2"/>
            </svg>
          </div>
        </td>
        <td style="vertical-align:middle;padding-left:14px">
          <p style="margin:0;color:white;font-size:20px;font-weight:800">Your Portfolio</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px">${month} Report</p>
        </td>
      </tr></table>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5">Hi <strong>dev</strong>, here's your portfolio summary for <strong>${month}</strong>.</p>
      ${summaryBlock}
      <p style="margin:0 0 10px;color:#111827;font-size:14px;font-weight:700">Performance</p>
      <div style="border-radius:10px;overflow:hidden;border:1px solid #f3f4f6">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f9fafb">
            <th style="padding:10px 14px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Name</th>
            <th style="padding:10px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Price</th>
            <th style="padding:10px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">30-Day %</th>
            <th style="padding:10px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Current Value</th>
          </tr></thead>
          <tbody>${stockRows}</tbody>
        </table>
      </div>
      <p style="margin:32px 0 0;color:#9ca3af;font-size:12px;text-align:center">Sent by Your Portfolio · Report sent on the 1st of each month.</p>
    </div>
  </div>
</body>
</html>`;

console.log("\nSending email to", TO, "…");
const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    from: "Your Portfolio <onboarding@resend.dev>",
    to: [TO],
    subject: `Your Portfolio – ${month} Report`,
    html,
  }),
});

const result = await res.json();
if (res.ok) {
  console.log("✓ Email sent! ID:", result.id);
} else {
  console.error("✗ Failed:", result);
}
