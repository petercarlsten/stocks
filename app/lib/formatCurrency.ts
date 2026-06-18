export function formatCurrency(value: number, currency: string, fractionDigits = 2): string {
  return (
    currency + " " +
    value.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  );
}
