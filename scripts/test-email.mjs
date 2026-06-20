// Test the monthly report — sends only to peter.carlsten (admin)
// Usage: node scripts/test-email.mjs
// On EC2: CRON_SECRET=<secret> node scripts/test-email.mjs

const BASE_URL    = process.env.BASE_URL    ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

console.log(`Calling ${BASE_URL}/api/cron/monthly-report?test=1 …`);

const res = await fetch(`${BASE_URL}/api/cron/monthly-report?test=1`, {
  headers: CRON_SECRET ? { authorization: `Bearer ${CRON_SECRET}` } : {},
});

const body = await res.json();
if (res.ok) {
  console.log("Results:");
  for (const r of body.results ?? []) {
    console.log(` ${r.username}: ${r.status}`);
  }
} else {
  console.error("Error:", body);
}
