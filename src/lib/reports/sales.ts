import { percentChange, safeDivide } from "@/lib/analytics/calc";
import { formatCurrency, formatNumber, formatPercent } from "./formatting";
import {
  comparisonTable,
  coreKpis,
  customersTable,
  kpiSection,
  productsTable,
  textSection,
  trendSection,
  unavailableSection,
} from "./sections";
import type { ReportInput, ReportSection } from "./types";

export function salesSummary(input: ReportInput): string[] {
  const c = input.organization.currency;
  const { current, previous, coverage } = input;
  if (!coverage.hasSales) {
    return ["No sales records were found for this period, so sales performance cannot be determined from the available data."];
  }
  const revChange = previous ? percentChange(current.revenue, previous.revenue) : null;
  const txChange = previous ? percentChange(current.transactions, previous.transactions) : null;
  const aov = safeDivide(current.revenue, current.transactions);
  return [
    `Revenue was ${formatCurrency(current.revenue, c)} from ${formatNumber(current.transactions)} transactions${
      revChange == null ? "." : `, ${formatPercent(revChange)} versus the previous period.`
    }`,
    `Units sold: ${formatNumber(current.units)}${txChange == null ? "." : `. Transaction volume moved ${formatPercent(txChange)}.`}`,
    aov == null ? "Average order value could not be calculated." : `Average order value was ${formatCurrency(aov, c)}.`,
  ];
}

export function buildSalesSections(input: ReportInput): ReportSection[] {
  if (!input.coverage.hasSales) {
    return [unavailableSection("sales", "Sales Performance", "No sales rows were found for this period.")];
  }
  return [
    kpiSection("kpis", "Sales Metrics", coreKpis(input).slice(0, 4)),
    trendSection(input, "revenue-trend", "Revenue Trend", "How did revenue move across the period?", "revenue", "currency"),
    trendSection(input, "sales-trend", "Sales Trend", "How did transaction volume move?", "transactions", "number", "bar"),
    productsTable(input, "products", "Top Products"),
    input.coverage.hasCustomers
      ? customersTable(input, "customers", "Top Customers")
      : unavailableSection("customers", "Top Customers", "No customer column was mapped on your data."),
    comparisonTable(input, "comparison", "Period Comparison"),
    textSection("observations", "Key Observations", [
      `Active days with recorded sales in this period: ${formatNumber(input.current.days)}.`,
      input.topProducts[0]
        ? `${input.topProducts[0].name} led product revenue at ${formatCurrency(input.topProducts[0].revenue, input.organization.currency)}.`
        : "No product-level breakdown is available for this period.",
    ]),
  ];
}
