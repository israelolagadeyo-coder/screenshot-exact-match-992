/** Reusable section builders shared by every report type. */
import { percentChange, safeDivide } from "@/lib/analytics/calc";
import { describeRange } from "@/lib/analytics/dates";
import { formatCurrency, formatNumber, formatPercent, share } from "./formatting";
import type { ReportFinding, ReportInput, ReportKpi, ReportSection } from "./types";

export const NOT_DETERMINED = "This cannot be determined from the available data.";

export function kpi(
  label: string,
  value: number | null,
  format: ReportKpi["format"],
  previous: number | null,
  hint: string,
  unavailableReason?: string,
): ReportKpi {
  return {
    label,
    value,
    format,
    changePercent: percentChange(value, previous),
    hint,
    ...(value == null && unavailableReason ? { unavailableReason } : {}),
  };
}

export function coreKpis(input: ReportInput): ReportKpi[] {
  const { current, previous, coverage } = input;
  const aov = safeDivide(current.revenue, current.transactions);
  const prevAov = previous ? safeDivide(previous.revenue, previous.transactions) : null;
  return [
    kpi(
      "Revenue",
      coverage.hasSales ? current.revenue : null,
      "currency",
      previous?.revenue ?? null,
      "Total revenue recorded in the reporting period.",
      "No sales data was found for this period.",
    ),
    kpi(
      "Transactions",
      coverage.hasSales ? current.transactions : null,
      "number",
      previous?.transactions ?? null,
      "Number of sales records in the reporting period.",
      "No sales data was found for this period.",
    ),
    kpi(
      "Units sold",
      coverage.hasSales ? current.units : null,
      "number",
      previous?.units ?? null,
      "Total quantity sold in the reporting period.",
      "No quantity column was mapped on your data.",
    ),
    kpi(
      "Average order value",
      aov,
      "currency",
      prevAov,
      "Revenue divided by the number of transactions.",
      "Not enough sales records to calculate an average.",
    ),
    kpi(
      "Customers",
      coverage.hasCustomers ? current.customers : null,
      "number",
      previous?.customers ?? null,
      "Distinct customers identified in the reporting period.",
      "No customer column was mapped on your data.",
    ),
    kpi(
      "Expenses",
      coverage.hasExpenses ? current.expenses : null,
      "currency",
      previous?.expenses ?? null,
      "Total expenses recorded in the reporting period.",
      "No expense data was found for this period.",
    ),
  ];
}

export function kpiSection(id: string, title: string, items: ReportKpi[]): ReportSection {
  return { id, title, type: "kpi", content: { items } };
}

export function textSection(id: string, title: string, paragraphs: string[]): ReportSection {
  return { id, title, type: "text", content: { paragraphs: paragraphs.filter(Boolean) } };
}

export function unavailableSection(id: string, title: string, reason: string): ReportSection {
  return { id, title, type: "unavailable", content: { reason } };
}

export function trendSection(
  input: ReportInput,
  id: string,
  title: string,
  question: string,
  dataKey: "revenue" | "transactions" | "units" | "expenses",
  valueKind: "currency" | "number",
  kind: "area" | "bar" | "line" = "area",
): ReportSection {
  return {
    id,
    title,
    type: "chart",
    content: { question, dataKey, valueKind, kind, grain: input.grain, points: input.trend },
  };
}

export function productsTable(input: ReportInput, id: string, title: string, rowsIn = input.topProducts): ReportSection {
  const currency = input.organization.currency;
  const total = input.current.revenue;
  return {
    id,
    title,
    type: "table",
    content: {
      csvKey: id,
      columns: [
        { key: "name", label: "Product" },
        { key: "revenue", label: "Revenue", align: "right" },
        { key: "units", label: "Units", align: "right" },
        { key: "transactions", label: "Transactions", align: "right" },
        { key: "contribution", label: "Share of revenue", align: "right" },
      ],
      rows: rowsIn.map((p) => ({
        name: p.name,
        revenue: formatCurrency(p.revenue, currency),
        units: formatNumber(p.units),
        transactions: formatNumber(p.transactions),
        contribution: share(p.revenue, total) == null ? "—" : `${share(p.revenue, total)!.toFixed(1)}%`,
      })),
    },
  };
}

export function customersTable(input: ReportInput, id: string, title: string): ReportSection {
  const currency = input.organization.currency;
  const total = input.current.revenue;
  return {
    id,
    title,
    type: "table",
    content: {
      csvKey: id,
      columns: [
        { key: "name", label: "Customer" },
        { key: "revenue", label: "Revenue", align: "right" },
        { key: "transactions", label: "Transactions", align: "right" },
        { key: "contribution", label: "Share of revenue", align: "right" },
      ],
      rows: input.topCustomers.map((c) => ({
        name: c.name,
        revenue: formatCurrency(c.revenue, currency),
        transactions: formatNumber(c.transactions),
        contribution: share(c.revenue, total) == null ? "—" : `${share(c.revenue, total)!.toFixed(1)}%`,
      })),
    },
  };
}

export function expensesTable(input: ReportInput, id: string, title: string): ReportSection {
  const currency = input.organization.currency;
  const total = input.current.expenses;
  return {
    id,
    title,
    type: "table",
    content: {
      csvKey: id,
      columns: [
        { key: "name", label: "Category" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "entries", label: "Entries", align: "right" },
        { key: "contribution", label: "Share of expenses", align: "right" },
      ],
      rows: input.expenseCategories.map((e) => ({
        name: e.name,
        amount: formatCurrency(e.amount, currency),
        entries: formatNumber(e.entries),
        contribution: share(e.amount, total) == null ? "—" : `${share(e.amount, total)!.toFixed(1)}%`,
      })),
    },
  };
}

export function comparisonTable(input: ReportInput, id: string, title: string): ReportSection {
  const currency = input.organization.currency;
  const { current, previous } = input;
  if (!previous) {
    return unavailableSection(
      id,
      title,
      "There is no comparable previous period of the same length in your data, so a period comparison is not available.",
    );
  }
  const row = (label: string, a: number, b: number, money: boolean) => ({
    metric: label,
    current: money ? formatCurrency(a, currency) : formatNumber(a),
    previous: money ? formatCurrency(b, currency) : formatNumber(b),
    change: formatPercent(percentChange(a, b)),
  });
  return {
    id,
    title,
    type: "table",
    content: {
      csvKey: id,
      columns: [
        { key: "metric", label: "Metric" },
        { key: "current", label: "This period", align: "right" },
        { key: "previous", label: "Previous period", align: "right" },
        { key: "change", label: "Change", align: "right" },
      ],
      rows: [
        row("Revenue", current.revenue, previous.revenue, true),
        row("Transactions", current.transactions, previous.transactions, false),
        row("Units sold", current.units, previous.units, false),
        row("Customers", current.customers, previous.customers, false),
        row("Expenses", current.expenses, previous.expenses, true),
      ],
    },
  };
}

/* --------------------------------------------------------------- insights */

export function buildFindings(input: ReportInput): ReportFinding[] {
  const currency = input.organization.currency;
  const { current, previous, coverage, topProducts, topCustomers } = input;
  const out: ReportFinding[] = [];
  const revChange = previous ? percentChange(current.revenue, previous.revenue) : null;

  if (coverage.hasSales && revChange != null) {
    out.push({
      title: `Revenue ${revChange >= 0 ? "increased" : "decreased"} by ${Math.abs(revChange).toFixed(1)}%`,
      evidence: `${formatCurrency(current.revenue, currency)} this period versus ${formatCurrency(previous!.revenue, currency)} in the previous period of the same length.`,
    });
  } else if (coverage.hasSales) {
    out.push({
      title: `Revenue for this period is ${formatCurrency(current.revenue, currency)}`,
      evidence: `${formatNumber(current.transactions)} transactions recorded between ${describeRange(input.range)}.`,
    });
  }

  if (topProducts[0]) {
    const s = share(topProducts[0].revenue, current.revenue);
    out.push({
      title: `${topProducts[0].name} contributed the most revenue`,
      evidence: `${formatCurrency(topProducts[0].revenue, currency)}${s == null ? "" : `, ${s.toFixed(1)}% of period revenue`}.`,
    });
  }

  if (topCustomers[0]) {
    const s = share(topCustomers[0].revenue, current.revenue);
    out.push({
      title: `${topCustomers[0].name} is the largest customer`,
      evidence: `${formatCurrency(topCustomers[0].revenue, currency)}${s == null ? "" : `, ${s.toFixed(1)}% of period revenue`}.`,
    });
  }

  if (coverage.hasExpenses && previous) {
    const expChange = percentChange(current.expenses, previous.expenses);
    if (expChange != null) {
      out.push({
        title: `Expenses ${expChange >= 0 ? "grew" : "fell"} by ${Math.abs(expChange).toFixed(1)}%`,
        evidence: `${formatCurrency(current.expenses, currency)} this period versus ${formatCurrency(previous.expenses, currency)} previously.`,
      });
    }
  }

  return out.slice(0, 5);
}

export function buildRisks(input: ReportInput): ReportFinding[] {
  const currency = input.organization.currency;
  const { current, previous, coverage, topProducts, topCustomers } = input;
  const out: ReportFinding[] = [];
  const revChange = previous ? percentChange(current.revenue, previous.revenue) : null;
  const txChange = previous ? percentChange(current.transactions, previous.transactions) : null;

  if (revChange != null && revChange < 0) {
    out.push({
      title: "Revenue declined against the previous period",
      evidence: `Revenue moved from ${formatCurrency(previous!.revenue, currency)} to ${formatCurrency(current.revenue, currency)} (${formatPercent(revChange)}).`,
      significance: Math.abs(revChange) > 15 ? "High" : "Moderate",
    });
  }
  if (txChange != null && txChange < 0) {
    out.push({
      title: "Transaction volume declined",
      evidence: `${formatNumber(current.transactions)} transactions versus ${formatNumber(previous!.transactions)} previously (${formatPercent(txChange)}).`,
      significance: Math.abs(txChange) > 15 ? "High" : "Moderate",
    });
  }
  const custShare = topCustomers[0] ? share(topCustomers[0].revenue, current.revenue) : null;
  if (custShare != null && custShare > 30) {
    out.push({
      title: "Revenue is concentrated in one customer",
      evidence: `${topCustomers[0]!.name} accounts for ${custShare.toFixed(1)}% of revenue in this period.`,
      significance: custShare > 50 ? "High" : "Moderate",
    });
  }
  const prodShare = topProducts[0] ? share(topProducts[0].revenue, current.revenue) : null;
  if (prodShare != null && prodShare > 40) {
    out.push({
      title: "Revenue is concentrated in one product",
      evidence: `${topProducts[0]!.name} accounts for ${prodShare.toFixed(1)}% of revenue in this period.`,
      significance: prodShare > 60 ? "High" : "Moderate",
    });
  }
  if (coverage.hasExpenses && previous) {
    const expChange = percentChange(current.expenses, previous.expenses);
    if (expChange != null && revChange != null && expChange > revChange && expChange > 0) {
      out.push({
        title: "Expenses are growing faster than revenue",
        evidence: `Expenses ${formatPercent(expChange)} versus revenue ${formatPercent(revChange)} over the same comparison.`,
        significance: "High",
      });
    }
  }
  return out.slice(0, 5);
}

export function buildOpportunities(input: ReportInput): ReportFinding[] {
  const currency = input.organization.currency;
  const { current, previous, coverage, topProducts, weakProducts } = input;
  const out: ReportFinding[] = [];
  const revChange = previous ? percentChange(current.revenue, previous.revenue) : null;

  if (revChange != null && revChange > 10) {
    out.push({
      title: "Growth momentum can be reinforced",
      evidence: `Revenue is ${formatPercent(revChange)} versus the previous period.`,
      nextStep: "Identify which products and customers drove the increase and protect their supply and service levels.",
    });
  }
  if (topProducts.length > 1 && topProducts[1]) {
    out.push({
      title: "Second-tier products have room to grow",
      evidence: `${topProducts[1].name} generated ${formatCurrency(topProducts[1].revenue, currency)} in this period, behind ${topProducts[0]!.name}.`,
      nextStep: "Test pricing, bundling or promotion on the strongest second-tier product.",
    });
  }
  if (weakProducts.length > 0 && weakProducts[0]) {
    out.push({
      title: "Weakest products may be worth reviewing",
      evidence: `${weakProducts[0].name} generated only ${formatCurrency(weakProducts[0].revenue, currency)} in this period.`,
      nextStep: "Decide whether to reposition, discount or discontinue the lowest-performing lines.",
    });
  }
  if (coverage.hasCustomers && current.newCustomers > 0) {
    out.push({
      title: "New customers can be converted into repeat buyers",
      evidence: `${formatNumber(current.newCustomers)} customers appear for the first time in this period.`,
      nextStep: "Follow up with first-time customers to encourage a second purchase.",
    });
  }
  return out.slice(0, 4);
}

export function buildRecommendations(
  input: ReportInput,
  risks: ReportFinding[],
  opportunities: ReportFinding[],
): ReportFinding[] {
  const out: ReportFinding[] = [];
  for (const risk of risks.slice(0, 2)) {
    out.push({
      title: `Address: ${risk.title.toLowerCase()}`,
      evidence: risk.evidence,
      nextStep:
        risk.title.includes("Expenses")
          ? "Review the expense categories that grew fastest and confirm each increase was intended."
          : risk.title.includes("concentrated")
            ? "Broaden the customer or product base so a single loss cannot remove most of your revenue."
            : "Investigate which products, customers or weeks lost volume, and act on the largest gap first.",
    });
  }
  for (const opp of opportunities.slice(0, 2)) {
    out.push({ title: `Pursue: ${opp.title.toLowerCase()}`, evidence: opp.evidence, ...(opp.nextStep ? { nextStep: opp.nextStep } : {}) });
  }
  if (!input.coverage.hasExpenses) {
    out.push({
      title: "Upload expense data",
      evidence: "No expense records were found, so cost and profitability cannot be calculated.",
      nextStep: "Upload an expense file so future reports can include margin and cost analysis.",
    });
  }
  return out.slice(0, 5);
}

export function buildLimitations(input: ReportInput): string[] {
  const out: string[] = [];
  const { coverage } = input;
  if (!coverage.hasSales) out.push("Sales analysis is unavailable because no sales rows were found for this period.");
  if (!coverage.hasExpenses)
    out.push("Expense analysis is unavailable because no expense dataset was found.");
  if (!coverage.hasCustomers)
    out.push("Customer analysis is unavailable because no customer column was mapped on your data.");
  if (!coverage.hasProducts)
    out.push("Product analysis is unavailable because no product column was mapped on your data.");
  out.push("Profit could not be determined from the available data, because cost of goods is not recorded.");
  if (!input.previous)
    out.push("No comparable previous period of the same length exists, so growth figures are limited.");
  return out;
}
