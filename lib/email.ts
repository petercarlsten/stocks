import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "placeholder");
}

export interface StockReport {
  symbol: string;
  name: string;
  currentPrice: number;
  change30d: number | null;
  positionValue: number | null;
  currency: string;
}

export interface ReportData {
  username: string;
  month: string;
  totalValueUSD: number | null;
  totalChange30dPct: number | null;
  totalEarnings30dUSD: number | null;
  stocks: StockReport[];
}

function fmt(value: number, currency: string): string {
  return (
    currency +
    " " +
    value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function fmtPct(pct: number | null): string {
  if (pct === null) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function pctColor(pct: number | null): string {
  if (pct === null) return "#6b7280";
  return pct >= 0 ? "#16a34a" : "#ef4444";
}

function buildHtml(data: ReportData): string {
  const stockRows = data.stocks
    .map(
      (s) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:right;color:#374151;font-size:13px;white-space:nowrap">${s.currentPrice > 0 ? fmt(s.currentPrice, s.currency) : "—"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;color:${pctColor(s.change30d)};font-size:13px">${fmtPct(s.change30d)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:right;color:#374151;font-size:13px;white-space:nowrap">${s.positionValue !== null ? fmt(s.positionValue, s.currency) : "—"}</td>
      </tr>`
    )
    .join("");

  const summaryBlock =
    data.totalValueUSD !== null
      ? `<div style="background:#f9fafb;border-radius:12px;padding:20px 24px;margin-bottom:28px;border:1px solid #f3f4f6">
          <table style="width:100%;border-collapse:collapse"><tr>
            <td style="vertical-align:top">
              <p style="margin:0 0 4px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Portfolio value</p>
              <p style="margin:0;color:#111827;font-size:26px;font-weight:800">${fmt(data.totalValueUSD, "USD")}</p>
            </td>
            ${
              data.totalChange30dPct !== null
                ? `<td style="text-align:right;vertical-align:top">
                <p style="margin:0 0 4px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">30-day change</p>
                <p style="margin:0;font-size:22px;font-weight:800;color:${pctColor(data.totalChange30dPct)}">${fmtPct(data.totalChange30dPct)}</p>
                ${data.totalEarnings30dUSD !== null ? `<p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${pctColor(data.totalEarnings30dUSD)}">${data.totalEarnings30dUSD >= 0 ? "+" : ""}${fmt(data.totalEarnings30dUSD, "USD")}</p>` : ""}
              </td>`
                : ""
            }
          </tr></table>
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Portfolio – ${data.month} Report</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:620px;margin:40px auto 60px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.08)">

    <!-- Header gradient -->
    <div style="background:linear-gradient(135deg,#6366f1 0%,#a855f7 50%,#10b981 100%);padding:28px 32px 24px">
      <table style="width:100%;border-collapse:collapse"><tr>
        <td style="vertical-align:middle">
          <div style="background:rgba(255,255,255,0.18);border-radius:12px;padding:10px;display:inline-block">
            <svg width="28" height="20" viewBox="0 0 56 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polyline points="2,30 12,22 22,26 34,10 46,6 54,2" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polygon points="2,30 12,22 22,26 34,10 46,6 54,2 54,34 2,34" fill="white" opacity="0.2"/>
              <circle cx="54" cy="2" r="3.5" fill="white"/>
            </svg>
          </div>
        </td>
        <td style="vertical-align:middle;padding-left:14px">
          <p style="margin:0;color:white;font-size:20px;font-weight:800;line-height:1.1">Your Portfolio</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px">${data.month} Report</p>
        </td>
      </tr></table>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5">
        Hi <strong>${data.username}</strong>, here's your portfolio summary for <strong>${data.month}</strong>.
      </p>

      ${summaryBlock}

      <!-- Stock table -->
      <p style="margin:0 0 10px;color:#111827;font-size:14px;font-weight:700">Performance</p>
      <div style="border-radius:10px;overflow:hidden;border:1px solid #f3f4f6">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px 14px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Name</th>
              <th style="padding:10px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Price</th>
              <th style="padding:10px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">30-Day %</th>
              <th style="padding:10px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Current Value</th>
            </tr>
          </thead>
          <tbody>${stockRows}</tbody>
        </table>
      </div>

      <p style="margin:32px 0 0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.6">
        Sent by Your Portfolio on the 1st of each month.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendMonthlyReport(to: string, data: ReportData) {
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  return getResend().emails.send({
    from: `Your Portfolio <${from}>`,
    to,
    subject: `Your Portfolio – ${data.month} Report`,
    html: buildHtml(data),
  });
}
