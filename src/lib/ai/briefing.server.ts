/** Deterministic AI executive briefing, built directly from Phase 3 analytics. */
import { buildBusinessHealth, percentChange, safeDivide } from "@/lib/analytics/calc";
import { describeRange } from "@/lib/analytics/dates";
import { TOOLS, detectSignals, resolvePeriod, type ToolContext } from "./engine.server";
import type { AiEvidence, ExecutiveBriefing } from "./types";

const money = (value: number | null, currency: string) => {
  if (value == null) return "Not available";
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
};
const pct = (v: number | null) => (v == null ? "not available" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

export async function buildBriefing(ctx: ToolContext, period: string | null): Promise<ExecutiveBriefing> {
  const range = resolvePeriod(period);
  const summary = await TOOLS["getBusinessSummary"]!.run(ctx, { period: period ?? "all" });
  const data = summary.data as Record<string, unknown>;
  const current = data["current"] as Record<string, number | null>;
  const previous = (data["previous"] ?? null) as Record<string, number | null> | null;
  const growth = data["growth"] as Record<string, number | null>;
  const available = data["availableData"] as Record<string, boolean>;
  const health = data["health"] as { score: number | null; status: string };
  const currency = ctx.org.currency;

  const products = (await TOOLS["getTopProducts"]!.run(ctx, { period: period ?? "all", limit: 5 })).data as Record<
    string,
    unknown
  >;
  const productList = (products["products"] ?? []) as { name: string; revenue: number }[];

  const wellPoints: string[] = [];
  const attentionPoints: string[] = [];
  const opportunityPoints: string[] = [];
  const nextSteps: string[] = [];

  if (available["sales"] && (current["revenue"] ?? 0) > 0) {
    wellPoints.push(`Revenue for ${range.label.toLowerCase()} is ${money(current["revenue"] ?? null, currency)} across ${(current["transactions"] ?? 0).toLocaleString()} transactions.`);
  }
  if ((growth["revenue"] ?? null) != null && (growth["revenue"] as number) > 0) {
    wellPoints.push(`Revenue is ${pct(growth["revenue"] ?? null)} versus the previous period.`);
  }
  if (current["averageOrderValue"] != null) {
    wellPoints.push(`Average order value is ${money(current["averageOrderValue"] ?? null, currency)}.`);
  }
  if (productList[0]) {
    wellPoints.push(`${productList[0].name} is the strongest product at ${money(productList[0].revenue, currency)}.`);
  }

  if ((growth["revenue"] ?? null) != null && (growth["revenue"] as number) < 0) {
    attentionPoints.push(`Revenue is ${pct(growth["revenue"] ?? null)} versus the previous period.`);
  }
  if ((growth["transactions"] ?? null) != null && (growth["transactions"] as number) < 0) {
    attentionPoints.push(`Transaction volume is ${pct(growth["transactions"] ?? null)} versus the previous period.`);
  }
  if (available["expenses"] && current["expenseToRevenueRatio"] != null) {
    attentionPoints.push(`Expenses are ${((current["expenseToRevenueRatio"] as number) * 100).toFixed(0)}% of revenue for this period.`);
  }
  const share = data["topCustomerRevenueSharePercent"] as number | null;
  if (share != null && share > 30) {
    attentionPoints.push(`One customer accounts for ${share.toFixed(0)}% of revenue — that is concentration risk.`);
  }
  if (!available["expenses"]) {
    attentionPoints.push("No expense data has been uploaded, so cost and profitability questions cannot be answered.");
  }

  if ((growth["revenue"] ?? null) != null && (growth["revenue"] as number) > 10) {
    opportunityPoints.push(`Potential opportunity: growth of ${pct(growth["revenue"] ?? null)} suggests the current product mix is working — worth identifying which lines drove it.`);
  }
  if (productList.length > 1 && productList[0]) {
    opportunityPoints.push(`Potential opportunity: the strongest product carries the range, so improving second-tier products may add revenue without new customers.`);
  }
  if (available["customers"] && (current["newCustomers"] ?? 0) > 0) {
    opportunityPoints.push(`Potential opportunity: ${current["newCustomers"]} customers appear for the first time in this period — worth encouraging a second purchase.`);
  }

  nextSteps.push(
    available["expenses"]
      ? "Review the largest expense categories against revenue for the same period."
      : "Upload an expense file so cost and margin questions become answerable.",
  );
  nextSteps.push("Open the AI Analyst and ask what changed this month to see the supporting numbers.");
  nextSteps.push(
    productList.length > 0
      ? "Check inventory and attention on the strongest products, and review the weakest ones."
      : "Map a product column on your uploaded data so product performance can be measured.",
  );

  const evidence: AiEvidence[] = [
    { label: "Period", value: describeRange(range), confidence: "known" },
    { label: "Revenue", value: money(current["revenue"] ?? null, currency), confidence: available["sales"] ? "known" : "unknown" },
    { label: "Revenue growth", value: pct(growth["revenue"] ?? null), confidence: previous ? "known" : "unknown" },
    { label: "Transactions", value: available["sales"] ? (current["transactions"] ?? 0).toLocaleString() : "Not available", confidence: available["sales"] ? "known" : "unknown" },
    { label: "Expenses", value: money(available["expenses"] ? current["expenses"] ?? null : null, currency), confidence: available["expenses"] ? "known" : "unknown" },
    { label: "Business health", value: health.score == null ? "Not available" : `${health.score}/100 (${health.status})`, confidence: health.score == null ? "unknown" : "inferred" },
  ];

  const headline = available["sales"]
    ? `For ${range.label.toLowerCase()}, ${ctx.org.name} recorded ${money(current["revenue"] ?? null, currency)} in revenue from ${(current["transactions"] ?? 0).toLocaleString()} transactions, ${
        growth["revenue"] == null ? "with no comparable previous period" : `${pct(growth["revenue"] ?? null)} versus the previous period`
      }.`
    : "No sales data has been uploaded yet, so business performance cannot be determined from the available data.";

  return {
    summary: headline,
    sections: [
      { heading: "What's going well", points: wellPoints.slice(0, 3) },
      { heading: "What needs attention", points: attentionPoints.slice(0, 3) },
      { heading: "Opportunities", points: opportunityPoints.slice(0, 3) },
      { heading: "Recommended next steps", points: nextSteps.slice(0, 3) },
    ].filter((s) => s.points.length > 0),
    evidence,
    generatedAt: new Date().toISOString(),
  };
}

export { detectSignals, buildBusinessHealth, percentChange, safeDivide };
