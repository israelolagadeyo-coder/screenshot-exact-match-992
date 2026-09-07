/**
 * Server-only collection of the analytics bundle a report needs.
 * Every read goes through the caller's authenticated Supabase client, so Row Level
 * Security decides which organisation's data is visible. Calculations are reused from
 * Phase 3 — nothing is recalculated here.
 */
import { buildBusinessHealth, buildDataQuality } from "@/lib/analytics/calc";
import { previousRange, suggestGrain } from "@/lib/analytics/dates";
import type {
  Coverage,
  CustomerRow,
  ExpenseCategoryRow,
  PeriodTotals,
  ProductRow,
  TrendPoint,
} from "@/lib/analytics/types";
import { resolvePeriod, type ToolContext } from "@/lib/ai/engine.server";
import type { ReportInput } from "./types";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function rpc(ctx: ToolContext, name: string, args: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (ctx.supabase as any).rpc(name, { _org: ctx.orgId, ...args });
  if (error) throw new Error(`Analytics unavailable: ${error.message}`);
  return data;
}

function toTotals(raw: unknown): PeriodTotals {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    revenue: num(r["revenue"]),
    transactions: num(r["transactions"]),
    units: num(r["units"]),
    expenses: num(r["expenses"]),
    expenseEntries: num(r["expenseEntries"]),
    customers: num(r["customers"]),
    newCustomers: num(r["newCustomers"]),
    products: num(r["products"]),
    days: num(r["days"]),
    periodStart: (r["periodStart"] as string) ?? null,
    periodEnd: (r["periodEnd"] as string) ?? null,
  };
}

function toCoverage(raw: unknown): Coverage {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    minDate: (r["minDate"] as string) ?? null,
    maxDate: (r["maxDate"] as string) ?? null,
    salesRows: num(r["salesRows"]),
    expenseRows: num(r["expenseRows"]),
    customerRows: num(r["customerRows"]),
    rowsWithDate: num(r["rowsWithDate"]),
    rowsWithRevenue: num(r["rowsWithRevenue"]),
    rowsWithProduct: num(r["rowsWithProduct"]),
    rowsWithCustomer: num(r["rowsWithCustomer"]),
    totalRows: num(r["totalRows"]),
    hasSales: Boolean(r["hasSales"]),
    hasExpenses: Boolean(r["hasExpenses"]),
    hasCustomers: Boolean(r["hasCustomers"]),
    hasProducts: Boolean(r["hasProducts"]),
  };
}

export async function collectReportInput(
  ctx: ToolContext & { org: { logo_url?: string | null } },
  periodKey: string,
  includeAi: boolean,
  apiKey: string | undefined,
): Promise<ReportInput> {
  const range = resolvePeriod(periodKey);
  const prev = previousRange(range);
  const grain = suggestGrain(range);

  const [coverageRaw, currentRaw, previousRaw, trendRaw, topProductsRaw, weakProductsRaw, topCustomersRaw, expenseRaw, datasetRows] =
    await Promise.all([
      rpc(ctx, "analytics_coverage", {}),
      rpc(ctx, "analytics_period", { _from: range.from, _to: range.to }),
      prev ? rpc(ctx, "analytics_period", { _from: prev.from, _to: prev.to }) : Promise.resolve(null),
      rpc(ctx, "analytics_trend", { _from: range.from, _to: range.to, _grain: grain }),
      rpc(ctx, "analytics_top_products", { _from: range.from, _to: range.to, _limit: 10, _ascending: false }),
      rpc(ctx, "analytics_top_products", { _from: range.from, _to: range.to, _limit: 5, _ascending: true }),
      rpc(ctx, "analytics_top_customers", { _from: range.from, _to: range.to, _limit: 10 }),
      rpc(ctx, "analytics_expense_categories", { _from: range.from, _to: range.to, _limit: 12 }),
      ctx.supabase
        .from("datasets")
        .select("name, row_count, status, validation")
        .eq("organization_id", ctx.orgId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  const coverage = toCoverage(coverageRaw);
  const current = toTotals(currentRaw);
  const previous = previousRaw ? toTotals(previousRaw) : null;

  const trend: TrendPoint[] = ((trendRaw ?? []) as Record<string, unknown>[]).map((row) => ({
    bucket: String(row["bucket"]),
    revenue: num(row["revenue"]),
    transactions: num(row["transactions"]),
    units: num(row["units"]),
    expenses: num(row["expenses"]),
  }));

  const products = (raw: unknown): ProductRow[] =>
    ((raw ?? []) as Record<string, unknown>[]).map((row) => ({
      name: String(row["name"]),
      revenue: num(row["revenue"]),
      units: num(row["units"]),
      transactions: num(row["transactions"]),
    }));

  const topProducts = products(topProductsRaw);
  const weakProducts = products(weakProductsRaw);

  const topCustomers: CustomerRow[] = ((topCustomersRaw ?? []) as Record<string, unknown>[]).map((row) => ({
    name: String(row["name"]),
    revenue: num(row["revenue"]),
    transactions: num(row["transactions"]),
  }));

  const expenseCategories: ExpenseCategoryRow[] = ((expenseRaw ?? []) as Record<string, unknown>[]).map((row) => ({
    name: String(row["name"]),
    amount: num(row["amount"]),
    entries: num(row["entries"]),
  }));

  const datasets = ((datasetRows?.data ?? []) as Record<string, unknown>[]).map((d) => ({
    name: String(d["name"] ?? "Dataset"),
    rows: num(d["row_count"]),
    status: String(d["status"] ?? "unknown"),
  }));

  const issues = ((datasetRows?.data ?? []) as Record<string, unknown>[]).reduce<{
    duplicates: number;
    invalidValues: number;
  }>(
    (acc, d) => {
      const v = (d["validation"] ?? {}) as Record<string, unknown>;
      return {
        duplicates: acc.duplicates + num(v["duplicates"]),
        invalidValues: acc.invalidValues + num(v["invalidDates"]) + num(v["invalidNumbers"]),
      };
    },
    { duplicates: 0, invalidValues: 0 },
  );

  const topCustomerShare =
    topCustomers[0] && current.revenue > 0 ? (topCustomers[0].revenue / current.revenue) * 100 : null;

  const health = buildBusinessHealth(current, previous, coverage, topCustomerShare);
  const quality = { ...buildDataQuality(coverage, issues), datasets };

  let ai: ReportInput["ai"] = {
    included: false,
    summary: null,
    sections: [],
    evidence: [],
    unavailableReason: null,
  };

  if (includeAi) {
    if (!apiKey) {
      ai = { ...ai, included: true, unavailableReason: "AI analysis is temporarily unavailable, so this report contains analytics only." };
    } else {
      try {
        const { buildBriefing } = await import("@/lib/ai/briefing.server");
        const briefing = await buildBriefing(ctx, periodKey);
        ai = {
          included: true,
          summary: briefing.summary,
          sections: briefing.sections,
          evidence: briefing.evidence,
          unavailableReason: null,
        };
      } catch (error) {
        console.error("[reports] AI analysis failed", error instanceof Error ? error.message : "unknown error");
        ai = {
          included: true,
          summary: null,
          sections: [],
          evidence: [],
          unavailableReason: "AI analysis could not be completed for this report. The analytics below are unaffected.",
        };
      }
    }
  }

  return {
    organization: {
      id: ctx.org.id,
      name: ctx.org.name,
      industry: ctx.org.industry,
      country: ctx.org.country,
      currency: ctx.org.currency,
      logoUrl: ctx.org.logo_url ?? null,
    },
    range,
    previousRange: prev,
    grain,
    coverage,
    current,
    previous,
    trend,
    topProducts,
    weakProducts,
    topCustomers,
    expenseCategories,
    health,
    quality,
    ai,
    generatedAt: new Date().toISOString(),
  };
}
