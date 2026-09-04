export function formatCurrency(value: number | null | undefined, currency: string): string {
  if (value == null || !Number.isFinite(value)) return "Not available";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${formatNumber(value)}`;
  }
}

export function formatCompactCurrency(
  value: number | null | undefined,
  currency: string,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency} ${formatNumber(value)}`;
  }
}

export function formatNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (value == null || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value == null || !Number.isFinite(value)) return "Not available";
  return `${value > 0 ? "+" : ""}${value.toFixed(fractionDigits)}%`;
}

export function formatMetric(
  value: number | null | undefined,
  kind: "currency" | "number" | "percent",
  currency: string,
): string {
  if (kind === "currency") return formatCurrency(value, currency);
  if (kind === "percent") return formatPercent(value);
  return formatNumber(value);
}
