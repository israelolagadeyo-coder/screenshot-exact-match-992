import type {
  BusinessHealth,
  Coverage,
  DataQualitySummary,
  HealthFactor,
  KPI,
  PeriodTotals,
  TrendDirection,
} from "./types";

export function percentChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function trendOf(
  current: number | null | undefined,
  previous: number | null | undefined,
): TrendDirection {
  if (current == null || previous == null) return "not_available";
  if (previous === 0) return current > 0 ? "new" : "not_available";
  const change = percentChange(current, previous);
  if (change == null) return "not_available";
  if (Math.abs(change) < 0.5) return "flat";
  return change > 0 ? "up" : "down";
}

export function safeDivide(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  const result = a / b;
  return Number.isFinite(result) ? result : null;
}

type KpiInput = {
  metric: string;
  label: string;
  value: number | null;
  previousValue: number | null;
  format: KPI["format"];
  hint: string;
  available?: boolean;
  unavailableReason?: string;
};

export function makeKpi(input: KpiInput): KPI {
  const available = input.available ?? input.value != null;
  return {
    metric: input.metric,
    label: input.label,
    value: available ? input.value : null,
    previousValue: input.previousValue,
    changePercent: percentChange(input.value, input.previousValue),
    trend: trendOf(input.value, input.previousValue),
    format: input.format,
    hint: input.hint,
    available,
    ...(input.unavailableReason ? { unavailableReason: input.unavailableReason } : {}),
  };
}

export function buildOverviewKpis(
  current: PeriodTotals,
  previous: PeriodTotals | null,
  coverage: Coverage,
): KPI[] {
  const prev = previous;
  const aov = safeDivide(current.revenue, current.transactions);
  const prevAov = prev ? safeDivide(prev.revenue, prev.transactions) : null;

  return [
    makeKpi({
      metric: "revenue",
      label: "Revenue",
      value: coverage.hasSales ? current.revenue : null,
      previousValue: prev?.revenue ?? null,
      format: "currency",
      hint: "Total revenue recorded in the selected period.",
      available: coverage.hasSales,
      unavailableReason: "No sales dataset has been uploaded.",
    }),
    makeKpi({
      metric: "transactions",
      label: "Transactions",
      value: coverage.hasSales ? current.transactions : null,
      previousValue: prev?.transactions ?? null,
      format: "number",
      hint: "Number of sales rows in the selected period.",
      available: coverage.hasSales,
      unavailableReason: "No sales dataset has been uploaded.",
    }),
    makeKpi({
      metric: "units_sold",
      label: "Units sold",
      value: coverage.hasSales ? current.units : null,
      previousValue: prev?.units ?? null,
      format: "number",
      hint: "Total quantity sold in the selected period.",
      available: coverage.hasSales,
      unavailableReason: "No sales dataset has been uploaded.",
    }),
    makeKpi({
      metric: "average_order_value",
      label: "Average order value",
      value: aov,
      previousValue: prevAov,
      format: "currency",
      hint: "Revenue divided by number of transactions.",
      available: coverage.hasSales && aov != null,
      unavailableReason: "Not enough sales rows to calculate an average.",
    }),
    makeKpi({
      metric: "customers",
      label: "Customers",
      value: coverage.hasCustomers ? current.customers : null,
      previousValue: prev?.customers ?? null,
      format: "number",
      hint: "Distinct customers identified in the selected period.",
      available: coverage.hasCustomers,
      unavailableReason: "This dataset does not contain identifiable customer information.",
    }),
    makeKpi({
      metric: "expenses",
      label: "Expenses",
      value: coverage.hasExpenses ? current.expenses : null,
      previousValue: prev?.expenses ?? null,
      format: "currency",
      hint: "Total expenses recorded in the selected period.",
      available: coverage.hasExpenses,
      unavailableReason: "No expense dataset has been uploaded.",
    }),
  ];
}

export function buildBusinessHealth(
  current: PeriodTotals,
  previous: PeriodTotals | null,
  coverage: Coverage,
  topCustomerShare: number | null,
): BusinessHealth {
  const factors: HealthFactor[] = [];
  const scores: number[] = [];

  const score01 = (change: number | null, invert = false) => {
    if (change == null) return null;
    const c = invert ? -change : change;
    // -20% -> 0, 0% -> 50, +20% or better -> 100
    return Math.max(0, Math.min(100, 50 + (c / 20) * 50));
  };

  const revenueChange = previous ? percentChange(current.revenue, previous.revenue) : null;
  if (coverage.hasSales && revenueChange != null) {
    const s = score01(revenueChange);
    if (s != null) scores.push(s);
    factors.push({
      label: "Revenue growth",
      detail: `Revenue changed ${revenueChange.toFixed(1)}% versus the previous period.`,
      kind: revenueChange >= 0 ? "positive" : "warning",
    });
  }

  const txChange = previous ? percentChange(current.transactions, previous.transactions) : null;
  if (coverage.hasSales && txChange != null) {
    const s = score01(txChange);
    if (s != null) scores.push(s);
    factors.push({
      label: "Transaction growth",
      detail: `Transactions changed ${txChange.toFixed(1)}% versus the previous period.`,
      kind: txChange >= 0 ? "positive" : "warning",
    });
  }

  const custChange = previous ? percentChange(current.customers, previous.customers) : null;
  if (coverage.hasCustomers && custChange != null) {
    const s = score01(custChange);
    if (s != null) scores.push(s);
    factors.push({
      label: "Customer growth",
      detail: `Active customers changed ${custChange.toFixed(1)}% versus the previous period.`,
      kind: custChange >= 0 ? "positive" : "warning",
    });
  }

  const expChange = previous ? percentChange(current.expenses, previous.expenses) : null;
  if (coverage.hasExpenses && expChange != null) {
    const s = score01(expChange, true);
    if (s != null) scores.push(s);
    factors.push({
      label: "Expense growth",
      detail: `Expenses changed ${expChange.toFixed(1)}% versus the previous period.`,
      kind: expChange <= 0 ? "positive" : "warning",
    });
  }

  if (topCustomerShare != null) {
    const s = Math.max(0, Math.min(100, 100 - topCustomerShare));
    scores.push(s);
    factors.push({
      label: "Customer concentration",
      detail: `The largest customer accounts for ${topCustomerShare.toFixed(1)}% of revenue.`,
      kind: topCustomerShare > 40 ? "warning" : "positive",
    });
  }

  if (scores.length === 0) {
    return {
      score: null,
      status: "This cannot be determined from the available data.",
      factors: [
        {
          label: "Not enough comparable data",
          detail:
            "A health score needs at least one metric with a comparable previous period. Choose a dated range or upload more history.",
          kind: "neutral",
        },
      ],
    };
  }

  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const status =
    score >= 75 ? "Strong" : score >= 60 ? "Healthy" : score >= 45 ? "Mixed" : "Needs attention";
  return { score, status, factors };
}

export function buildDataQuality(
  coverage: Coverage,
  datasetIssues: { duplicates: number; invalidValues: number },
): DataQualitySummary {
  const total = coverage.totalRows;
  const missingDates = Math.max(0, total - coverage.rowsWithDate);
  const missingRevenue = Math.max(0, coverage.salesRows - coverage.rowsWithRevenue);
  const problems = missingDates + missingRevenue + datasetIssues.invalidValues;
  const score = total > 0 ? Math.max(0, Math.round(100 - (problems / total) * 100)) : null;

  const available: string[] = [];
  const unavailable: string[] = [];
  (coverage.hasSales ? available : unavailable).push("Revenue and sales");
  (coverage.hasProducts ? available : unavailable).push("Product performance");
  (coverage.hasCustomers ? available : unavailable).push("Customer analysis");
  (coverage.hasExpenses ? available : unavailable).push("Expense analysis");

  return {
    score,
    rowsProcessed: total,
    rowsWithDate: coverage.rowsWithDate,
    rowsWithRevenue: coverage.rowsWithRevenue,
    missingDates,
    missingRevenue,
    duplicates: datasetIssues.duplicates,
    invalidValues: datasetIssues.invalidValues,
    availableMetrics: available,
    unavailableMetrics: unavailable,
  };
}
