import { percentChange, safeDivide } from "@/lib/analytics/calc";
import { formatCurrency, formatNumber, formatPercent, share } from "./formatting";
import {
  expensesTable,
  kpi,
  kpiSection,
  textSection,
  trendSection,
  unavailableSection,
} from "./sections";
import type { ReportInput, ReportSection } from "./types";

export function expenseSummary(input: ReportInput): string[] {
  const c = input.organization.currency;
  const { current, previous, coverage, expenseCategories } = input;
  if (!coverage.hasExpenses) {
    return ["Expense analysis is unavailable because no expense dataset was found."];
  }
  const change = previous ? percentChange(current.expenses, previous.expenses) : null;
  const ratio = safeDivide(current.expenses, current.revenue);
  return [
    `Expenses totalled ${formatCurrency(current.expenses, c)} across ${formatNumber(current.expenseEntries)} entries${change == null ? "." : `, ${formatPercent(change)} versus the previous period.`}`,
    ratio == null
      ? "The expense-to-revenue relationship could not be calculated because no revenue was recorded."
      : `Expenses represent ${(ratio * 100).toFixed(1)}% of revenue for this period.`,
    expenseCategories[0]
      ? `${expenseCategories[0].name} is the largest category at ${formatCurrency(expenseCategories[0].amount, c)}.`
      : "No expense categories could be identified in this period.",
    "Profit could not be determined from the available data, because cost of goods is not recorded.",
  ];
}

export function buildExpenseSections(input: ReportInput): ReportSection[] {
  if (!input.coverage.hasExpenses) {
    return [
      unavailableSection(
        "expenses",
        "Expense Report",
        "Expense analysis is unavailable because no expense dataset was found.",
      ),
    ];
  }
  const { current, previous } = input;
  const ratio = safeDivide(current.expenses, current.revenue);
  const prevRatio = previous ? safeDivide(previous.expenses, previous.revenue) : null;
  const top3 = input.expenseCategories.slice(0, 3).reduce((s, e) => s + e.amount, 0);
  const topShare = share(top3, current.expenses);

  return [
    kpiSection("kpis", "Expense Metrics", [
      kpi("Total expenses", current.expenses, "currency", previous?.expenses ?? null, "All expense rows in the period."),
      kpi("Expense entries", current.expenseEntries, "number", previous?.expenseEntries ?? null, "Number of expense records."),
      kpi(
        "Expense to revenue",
        ratio == null ? null : ratio * 100,
        "percent",
        prevRatio == null ? null : prevRatio * 100,
        "Expenses as a share of revenue in the same period.",
        "Revenue is zero for this period, so the ratio cannot be calculated.",
      ),
    ]),
    trendSection(input, "expense-trend", "Expense Trend", "How did spending move across the period?", "expenses", "currency", "bar"),
    expensesTable(input, "categories", "Expense Categories"),
    textSection("significant", "Significant Changes", [
      topShare == null
        ? "Category concentration could not be calculated."
        : `The three largest categories account for ${topShare.toFixed(1)}% of period expenses.`,
      previous && percentChange(current.expenses, previous.expenses) != null
        ? `Total spending moved ${formatPercent(percentChange(current.expenses, previous.expenses))} against the previous period of the same length.`
        : "No comparable previous period is available for expense comparison.",
    ]),
  ];
}
