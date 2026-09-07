import { percentChange, safeDivide } from "@/lib/analytics/calc";
import { formatCurrency, formatNumber, formatPercent } from "./formatting";
import {
  comparisonTable,
  coreKpis,
  customersTable,
  expensesTable,
  kpiSection,
  productsTable,
  textSection,
  trendSection,
  unavailableSection,
} from "./sections";
import type { ReportInput, ReportSection } from "./types";

export function executiveSummary(input: ReportInput): string[] {
  const c = input.organization.currency;
  const { current, previous, coverage, topProducts, health } = input;
  const lines: string[] = [];

  if (!coverage.hasSales) {
    return [
      `No sales records were found for ${input.range.label.toLowerCase()}, so business performance cannot be determined from the available data.`,
    ];
  }

  const revChange = previous ? percentChange(current.revenue, previous.revenue) : null;
  lines.push(
    `${input.organization.name} recorded ${formatCurrency(current.revenue, c)} in revenue across ${formatNumber(current.transactions)} transactions during this period` +
      (revChange == null
        ? ", with no comparable previous period available for growth."
        : `, ${revChange >= 0 ? "up" : "down"} ${Math.abs(revChange).toFixed(1)}% against the previous period of the same length.`),
  );

  const aov = safeDivide(current.revenue, current.transactions);
  if (aov != null) lines.push(`Average order value was ${formatCurrency(aov, c)}.`);

  if (topProducts[0])
    lines.push(`The strongest-performing product was ${topProducts[0].name} at ${formatCurrency(topProducts[0].revenue, c)}.`);

  if (coverage.hasCustomers) {
    const custChange = previous ? percentChange(current.customers, previous.customers) : null;
    lines.push(
      `Customer activity: ${formatNumber(current.customers)} customers` +
        (custChange == null ? " in this period." : `, ${formatPercent(custChange)} versus the previous period.`),
    );
  }

  if (coverage.hasExpenses) {
    const expChange = previous ? percentChange(current.expenses, previous.expenses) : null;
    lines.push(
      `Expenses totalled ${formatCurrency(current.expenses, c)}` +
        (expChange == null ? " in this period." : `, ${formatPercent(expChange)} versus the previous period.`),
    );
  } else {
    lines.push("Expense analysis is unavailable because no expense dataset was found.");
  }

  lines.push(
    health.score == null
      ? "A business health score could not be calculated for this period."
      : `Overall business health scores ${health.score} out of 100 (${health.status.toLowerCase()}).`,
  );

  return lines;
}

export function buildExecutiveSections(input: ReportInput): ReportSection[] {
  const c = input.organization.currency;
  const sections: ReportSection[] = [
    textSection("overview", "Business Overview", [
      `${input.organization.name}${input.organization.industry ? ` operates in ${input.organization.industry}` : ""}, based in ${input.organization.country}, reporting in ${c}.`,
      `This report covers ${input.range.label.toLowerCase()} and was calculated from ${formatNumber(input.quality.rowsProcessed)} uploaded data rows at the time of generation.`,
    ]),
    kpiSection("kpis", "Key Metrics", coreKpis(input)),
  ];

  if (input.coverage.hasSales) {
    sections.push(trendSection(input, "revenue-trend", "Revenue Performance", "How did revenue move across the period?", "revenue", "currency"));
    sections.push(trendSection(input, "sales-trend", "Sales Performance", "How did transaction volume move?", "transactions", "number", "bar"));
  } else {
    sections.push(unavailableSection("revenue-trend", "Revenue Performance", "No sales rows were found for this period."));
  }

  sections.push(
    input.coverage.hasCustomers
      ? customersTable(input, "customers", "Customer Performance")
      : unavailableSection("customers", "Customer Performance", "No customer column was mapped on your data, so customer performance is unavailable."),
  );

  sections.push(
    input.coverage.hasProducts
      ? productsTable(input, "products", "Product Performance")
      : unavailableSection("products", "Product Performance", "No product column was mapped on your data, so product performance is unavailable."),
  );

  sections.push(
    input.coverage.hasExpenses
      ? expensesTable(input, "expenses", "Expense Overview")
      : unavailableSection("expenses", "Expense Overview", "Expense analysis is unavailable because no expense dataset was found."),
  );

  sections.push(comparisonTable(input, "comparison", "Period Comparison"));

  sections.push(
    textSection(
      "health",
      "Business Health",
      [
        input.health.score == null
          ? input.health.status
          : `Health score: ${input.health.score}/100 — ${input.health.status}.`,
        ...input.health.factors.map((f) => `${f.label}: ${f.detail}`),
      ],
    ),
  );

  return sections;
}
