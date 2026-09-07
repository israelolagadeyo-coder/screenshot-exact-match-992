import { percentChange } from "@/lib/analytics/calc";
import { formatCurrency, formatNumber, formatPercent, share } from "./formatting";
import {
  customersTable,
  kpi,
  kpiSection,
  textSection,
  trendSection,
  unavailableSection,
} from "./sections";
import type { ReportInput, ReportSection } from "./types";

export function customerSummary(input: ReportInput): string[] {
  const c = input.organization.currency;
  const { current, previous, coverage, topCustomers } = input;
  if (!coverage.hasCustomers) {
    return ["Customer analysis is unavailable because no customer column was mapped on your data."];
  }
  const change = previous ? percentChange(current.customers, previous.customers) : null;
  const topShare = topCustomers[0] ? share(topCustomers[0].revenue, current.revenue) : null;
  return [
    `${formatNumber(current.customers)} customers were active in this period${change == null ? "." : `, ${formatPercent(change)} versus the previous period.`}`,
    `${formatNumber(current.newCustomers)} of them appear in your data for the first time in this period.`,
    topCustomers[0]
      ? `${topCustomers[0].name} is the largest customer at ${formatCurrency(topCustomers[0].revenue, c)}${topShare == null ? "." : `, ${topShare.toFixed(1)}% of period revenue.`}`
      : "No individual customer revenue could be attributed in this period.",
  ];
}

export function buildCustomerSections(input: ReportInput): ReportSection[] {
  if (!input.coverage.hasCustomers) {
    return [
      unavailableSection(
        "customers",
        "Customer Performance",
        "Customer analysis is unavailable because no customer column was mapped on your data.",
      ),
    ];
  }
  const { current, previous, topCustomers } = input;
  const top5 = topCustomers.slice(0, 5).reduce((sum, c) => sum + c.revenue, 0);
  const concentration = share(top5, current.revenue);

  return [
    kpiSection("kpis", "Customer Metrics", [
      kpi("Customers", current.customers, "number", previous?.customers ?? null, "Distinct customers active in the period."),
      kpi("New customers", current.newCustomers, "number", previous?.newCustomers ?? null, "Customers appearing for the first time."),
      kpi(
        "Returning customers",
        Math.max(0, current.customers - current.newCustomers),
        "number",
        previous ? Math.max(0, previous.customers - previous.newCustomers) : null,
        "Customers who also appear earlier in your data.",
      ),
      kpi("Revenue per customer", current.customers > 0 ? current.revenue / current.customers : null, "currency", previous && previous.customers > 0 ? previous.revenue / previous.customers : null, "Period revenue divided by active customers."),
    ]),
    customersTable(input, "top-customers", "Top Customers"),
    trendSection(input, "customer-trend", "Customer Revenue Trend", "How did revenue from customers move?", "revenue", "currency"),
    textSection("concentration", "Concentration Indicators", [
      concentration == null
        ? "Customer concentration could not be calculated for this period."
        : `The top five customers account for ${concentration.toFixed(1)}% of period revenue.`,
      concentration != null && concentration > 60
        ? "A small number of customers carries most of the revenue, which increases the impact of losing any one of them."
        : "Revenue is spread across a reasonable number of customers for this period.",
    ]),
  ];
}
