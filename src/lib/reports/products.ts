import { formatCurrency, formatNumber, share } from "./formatting";
import {
  kpi,
  kpiSection,
  productsTable,
  textSection,
  trendSection,
  unavailableSection,
} from "./sections";
import type { ReportInput, ReportSection } from "./types";

export function productSummary(input: ReportInput): string[] {
  const c = input.organization.currency;
  const { current, coverage, topProducts, weakProducts } = input;
  if (!coverage.hasProducts) {
    return ["Product analysis is unavailable because no product column was mapped on your data."];
  }
  const topShare = topProducts[0] ? share(topProducts[0].revenue, current.revenue) : null;
  return [
    `${formatNumber(current.products)} products recorded sales in this period, generating ${formatCurrency(current.revenue, c)} in total revenue.`,
    topProducts[0]
      ? `${topProducts[0].name} was the strongest product at ${formatCurrency(topProducts[0].revenue, c)}${topShare == null ? "." : `, ${topShare.toFixed(1)}% of period revenue.`}`
      : "No individual product revenue could be attributed in this period.",
    weakProducts[0]
      ? `${weakProducts[0].name} was the lowest-performing product at ${formatCurrency(weakProducts[0].revenue, c)}.`
      : "No lowest-performing product could be identified for this period.",
  ];
}

export function buildProductSections(input: ReportInput): ReportSection[] {
  if (!input.coverage.hasProducts) {
    return [
      unavailableSection(
        "products",
        "Product Performance",
        "Product analysis is unavailable because no product column was mapped on your data.",
      ),
    ];
  }
  const { current, previous, topProducts } = input;
  const top5 = topProducts.slice(0, 5).reduce((sum, p) => sum + p.revenue, 0);
  const contribution = share(top5, current.revenue);

  return [
    kpiSection("kpis", "Product Metrics", [
      kpi("Products sold", current.products, "number", previous?.products ?? null, "Distinct products with sales in the period."),
      kpi("Units sold", current.units, "number", previous?.units ?? null, "Total quantity sold in the period."),
      kpi("Product revenue", current.revenue, "currency", previous?.revenue ?? null, "Revenue attributed to sales rows."),
    ]),
    productsTable(input, "top-products", "Top Products"),
    productsTable(input, "weak-products", "Lowest-Performing Products", input.weakProducts),
    trendSection(input, "units-trend", "Units Sold Trend", "How did volume move across the period?", "units", "number", "bar"),
    textSection("contribution", "Product Contribution", [
      contribution == null
        ? "Product contribution could not be calculated for this period."
        : `The top five products account for ${contribution.toFixed(1)}% of period revenue.`,
      "Category performance requires a category column on your uploaded data; it is not available in this report.",
    ]),
  ];
}
