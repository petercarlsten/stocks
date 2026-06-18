export function formatCurrency(value: number, currency: string, fractionDigits = 2): string {
  if (currency === "USD") {
    return (
      "USD " +
      value.toLocaleString("en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })
    );
  }
  return value.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
