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

export interface MonthlyBudget {
  simple: number;
  withGrowth: number;
  withGrowthReal: number;
  drawdownDate: string;
  growthRate: number;
  inflationRate: number;
}

export interface ReportData {
  username: string;
  month: string;
  totalValueUSD: number | null;
  totalChange30dPct: number | null;
  totalEarnings30dUSD: number | null;
  currency: string;
  stocks: StockReport[];
  monthlyBudget?: MonthlyBudget;
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

function buildBudgetBlock(budget: MonthlyBudget, currency: string): string {
  const endDate = new Date(budget.drawdownDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const row = (label: string, value: number, note: string) =>
    `<tr>
      <td style="padding:8px 14px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:12px">${label}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #f3f4f6;text-align:right;color:#4f46e5;font-size:13px;font-weight:700">${fmt(value, currency)}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #f3f4f6;text-align:right;color:#9ca3af;font-size:11px">${note}</td>
    </tr>`;
  return `
    <p style="margin:24px 0 10px;color:#111827;font-size:14px;font-weight:700">Monthly Living Budget</p>
    <div style="border-radius:10px;overflow:hidden;border:1px solid #f3f4f6;margin-bottom:8px">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f9fafb">
          <th style="padding:8px 14px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Scenario</th>
          <th style="padding:8px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Per Month</th>
          <th style="padding:8px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Assumptions</th>
        </tr></thead>
        <tbody>
          ${row("Zero gains", budget.simple, `end date: ${endDate}`)}
          ${row("With gains", budget.withGrowth, `+${budget.growthRate}%/yr · end date: ${endDate}`)}
          ${row("Real value", budget.withGrowthReal, `+${budget.growthRate}% −${budget.inflationRate}% infl. · end date: ${endDate}`)}
        </tbody>
      </table>
    </div>`;
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
              <p style="margin:0;color:#111827;font-size:26px;font-weight:800">${fmt(data.totalValueUSD, data.currency)}</p>
            </td>
            ${
              data.totalChange30dPct !== null
                ? `<td style="text-align:right;vertical-align:top">
                <p style="margin:0 0 4px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">30-day change</p>
                <p style="margin:0;font-size:22px;font-weight:800;color:${pctColor(data.totalChange30dPct)}">${fmtPct(data.totalChange30dPct)}</p>
                ${data.totalEarnings30dUSD !== null ? `<p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${pctColor(data.totalEarnings30dUSD)}">${data.totalEarnings30dUSD >= 0 ? "+" : ""}${fmt(data.totalEarnings30dUSD, data.currency)}</p>` : ""}
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
  <title>My Portfolio Value for ${data.month}</title>
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
          <p style="margin:0;color:white;font-size:20px;font-weight:800;line-height:1.1">My Portfolio Value for ${data.month}</p>
        </td>
      </tr></table>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5">
        Hi <strong>${data.username}</strong>, here's your portfolio summary for <strong>${data.month}</strong>.
      </p>

      ${summaryBlock}
      ${data.monthlyBudget ? buildBudgetBlock(data.monthlyBudget, data.currency) : ""}

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
        Sent by My Portfolio on the 1st of each month.
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
    subject: `My Portfolio Value for ${data.month}`,
    html: buildHtml(data),
  });
}

// ─── Yearly report ────────────────────────────────────────────────────────────

export interface YearlyStockReport {
  symbol: string;
  name: string;
  currentPrice: number;
  changeYr: number | null;
  positionValue: number | null;
  earningsYr: number | null;
  currency: string;
}

export interface YearlyReportData {
  username: string;
  year: number;
  totalValueUSD: number | null;
  totalChangeYrPct: number | null;
  totalEarningsYrUSD: number | null;
  currency: string;
  stocks: YearlyStockReport[];
  monthlyBudget?: MonthlyBudget;
}

function buildYearlyHtml(data: YearlyReportData): string {
  const stockRows = data.stocks
    .map(
      (s) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:right;color:#374151;font-size:13px;white-space:nowrap">${s.currentPrice > 0 ? fmt(s.currentPrice, s.currency) : "—"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;color:${pctColor(s.changeYr)};font-size:13px">${fmtPct(s.changeYr)}</td>
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
              <p style="margin:0;color:#111827;font-size:26px;font-weight:800">${fmt(data.totalValueUSD, data.currency)}</p>
            </td>
            ${
              data.totalChangeYrPct !== null
                ? `<td style="text-align:right;vertical-align:top">
                <p style="margin:0 0 4px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">${data.year} change</p>
                <p style="margin:0;font-size:22px;font-weight:800;color:${pctColor(data.totalChangeYrPct)}">${fmtPct(data.totalChangeYrPct)}</p>
                ${data.totalEarningsYrUSD !== null ? `<p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${pctColor(data.totalEarningsYrUSD)}">${data.totalEarningsYrUSD >= 0 ? "+" : ""}${fmt(data.totalEarningsYrUSD, data.currency)}</p>` : ""}
              </td>`
                : ""
            }
          </tr></table>
        </div>`
      : "";

  const title = `My Portfolio — Year in Review ${data.year}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:620px;margin:40px auto 60px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.08)">

    <!-- Header gradient -->
    <div style="background:linear-gradient(135deg,#f59e0b 0%,#ef4444 50%,#6366f1 100%);padding:28px 32px 24px">
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
          <p style="margin:0;color:white;font-size:20px;font-weight:800;line-height:1.1">${title}</p>
        </td>
      </tr></table>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5">
        Hi <strong>${data.username}</strong>, here's how your portfolio performed in <strong>${data.year}</strong>.
      </p>

      ${summaryBlock}
      ${data.monthlyBudget ? buildBudgetBlock(data.monthlyBudget, data.currency) : ""}

      <!-- Stock table -->
      <p style="margin:0 0 10px;color:#111827;font-size:14px;font-weight:700">Year Performance</p>
      <div style="border-radius:10px;overflow:hidden;border:1px solid #f3f4f6">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px 14px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Name</th>
              <th style="padding:10px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Year-end Price</th>
              <th style="padding:10px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">1-Year %</th>
              <th style="padding:10px 14px;text-align:right;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Current Value</th>
            </tr>
          </thead>
          <tbody>${stockRows}</tbody>
        </table>
      </div>

      <p style="margin:32px 0 0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.6">
        Sent by My Portfolio on January 1st.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendYearlyReport(to: string, data: YearlyReportData) {
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  return getResend().emails.send({
    from: `Your Portfolio <${from}>`,
    to,
    subject: `My Portfolio — Year in Review ${data.year}`,
    html: buildYearlyHtml(data),
  });
}
