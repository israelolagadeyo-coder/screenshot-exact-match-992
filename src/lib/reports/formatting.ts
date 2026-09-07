/** Centralised report number/date formatting. Reuses the Phase 3 formatters. */
import { format } from "date-fns";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/analytics/format";
import type { ReportKpi } from "./types";

export { formatCurrency, formatNumber, formatPercent };

export function formatReportDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return "Not available";
  return format(d, "d MMMM yyyy");
}

export function formatReportDateTime(value: string | null | undefined): string {
  if (!value) return "Not available";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not available";
  return `${format(d, "d MMMM yyyy")} at ${format(d, "h:mm a")}`;
}

export function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return "All available data";
  return `${formatReportDate(start)} — ${formatReportDate(end)}`;
}

export function formatKpiValue(kpi: ReportKpi, currency: string): string {
  if (kpi.value == null) return "Not available";
  if (kpi.format === "currency") return formatCurrency(kpi.value, currency);
  if (kpi.format === "percent") return `${kpi.value.toFixed(1)}%`;
  return formatNumber(kpi.value);
}

export function share(part: number | null, whole: number | null): number | null {
  if (part == null || whole == null || whole === 0) return null;
  const value = (part / whole) * 100;
  return Number.isFinite(value) ? value : null;
}
