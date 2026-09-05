/**
 * Phase 4 — AI Business Analyst engine (server only).
 *
 * Architecture:
 *   user -> analyst -> controlled tools -> Phase 3 analytics functions -> RLS -> data
 *
 * The model never queries the database. It may only call the approved tools below,
 * and every tool runs through the caller's own authenticated Supabase client, so
 * Row Level Security decides which organisation's rows are visible.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildRange, describeRange, previousRange, suggestGrain } from "@/lib/analytics/dates";
import { buildBusinessHealth, buildOverviewKpis, percentChange, safeDivide } from "@/lib/analytics/calc";
import type { AnalyticsDateRange, Coverage, DateRangePresetKey, PeriodTotals } from "@/lib/analytics/types";
import type { AiEvidence, AiToolCallRecord, Confidence } from "./types";

export const ANALYST_MODEL = "openai/gpt-5.6-sol";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MAX_ROUNDS = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type OrgProfile = {
  id: string;
  name: string;
  industry: string | null;
  country: string;
  currency: string;
};

export type ToolContext = {
  supabase: Db;
  orgId: string;
  org: OrgProfile;
};

/* ---------------------------------------------------------------- helpers */

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const PERIOD_KEYS: DateRangePresetKey[] = [
  "today",
  "yesterday",
  "last7",
  "last30",
  "last90",
  "this_month",
  "prev_month",
  "this_quarter",
  "prev_quarter",
  "this_year",
  "prev_year",
  "all",
];

/** Turn a natural-language period reference into an explicit date range. */
export function resolvePeriod(period: string | null | undefined): AnalyticsDateRange {
  const key = (period ?? "all").toLowerCase().trim();
  const alias: Record<string, DateRangePresetKey> = {
    "": "all",
    all: "all",
    "all time": "all",
    today: "today",
    yesterday: "yesterday",
    "this week": "last7",
    "last week": "last7",
    "last 7 days": "last7",
    "previous 30 days": "last30",
    "last 30 days": "last30",
    "last 90 days": "last90",
    "this month": "this_month",
    "last month": "prev_month",
    "previous month": "prev_month",
    "this quarter": "this_quarter",
    "last quarter": "prev_quarter",
    "previous quarter": "prev_quarter",
    "this year": "this_year",
    "year to date": "this_year",
    ytd: "this_year",
    "last year": "prev_year",
    "previous year": "prev_year",
  };
  const resolved =
    (PERIOD_KEYS.includes(key as DateRangePresetKey) ? (key as DateRangePresetKey) : undefined) ??
    alias[key] ??
    "all";
  return buildRange(resolved);
}

function money(value: number | null, currency: string): string {
  if (value == null) return "Not available";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
}

const pct = (v: number | null): string => (v == null ? "Not available" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

function evidence(
  label: string,
  value: string,
  confidence: Confidence,
  period?: string,
  detail?: string,
): AiEvidence {
  return { label, value, confidence, ...(period ? { period } : {}), ...(detail ? { detail } : {}) };
}

/* ------------------------------------------------------------ data access */

async function rpc(ctx: ToolContext, name: string, args: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (ctx.supabase as any).rpc(name, { _org: ctx.orgId, ...args });
  if (error) throw new Error(`Analytics unavailable: ${error.message}`);
  return data;
}

async function coverageOf(ctx: ToolContext): Promise<Coverage> {
  const r = ((await rpc(ctx, "analytics_coverage", {})) ?? {}) as Record<string, unknown>;
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

async function totalsOf(ctx: ToolContext, range: AnalyticsDateRange | null): Promise<PeriodTotals> {
  const r = ((await rpc(ctx, "analytics_period", {
    _from: range?.from ?? null,
    _to: range?.to ?? null,
  })) ?? {}) as Record<string, unknown>;
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

/* ------------------------------------------------------- controlled tools */

export type ToolOutcome = {
  /** Compact JSON handed back to the model. Never raw rows. */
  data: Record<string, unknown>;
  /** Human-readable evidence surfaced in the UI. */
  evidence: AiEvidence[];
  summary: string;
};

type ToolArgs = Record<string, unknown>;

const str = (a: ToolArgs, k: string): string | null => {
  const v = a[k];
  return typeof v === "string" && v.trim() !== "" ? v : null;
};
const int = (a: ToolArgs, k: string, fallback: number): number => {
  const v = a[k];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(25, Math.floor(n)) : fallback;
};

async function periodBundle(ctx: ToolContext, period: string | null) {
  const range = resolvePeriod(period);
  const prev = previousRange(range);
  const [coverage, current, previous] = await Promise.all([
    coverageOf(ctx),
    totalsOf(ctx, range),
    prev ? totalsOf(ctx, prev) : Promise.resolve(null),
  ]);
  return { range, prev, coverage, current, previous };
}

function totalsPayload(t: PeriodTotals, coverage: Coverage) {
  return {
    revenue: coverage.hasSales ? t.revenue : null,
    transactions: coverage.hasSales ? t.transactions : null,
    units: t.units || null,
    averageOrderValue: safeDivide(t.revenue, t.transactions),
    customers: coverage.hasCustomers ? t.customers : null,
    newCustomers: coverage.hasCustomers ? t.newCustomers : null,
    products: coverage.hasProducts ? t.products : null,
    expenses: coverage.hasExpenses ? t.expenses : null,
    expenseToRevenueRatio: coverage.hasExpenses ? safeDivide(t.expenses, t.revenue) : null,
    activeDays: t.days,
  };
}

export const TOOLS: Record<
  string,
  { describe: (a: ToolArgs) => string; run: (ctx: ToolContext, a: ToolArgs) => Promise<ToolOutcome> }
> = {
  getBusinessContext: {
    describe: () => "Checked which business data is available",
    run: async (ctx) => {
      const coverage = await coverageOf(ctx);
      const data = {
        organization: {
          name: ctx.org.name,
          industry: ctx.org.industry,
          country: ctx.org.country,
          currency: ctx.org.currency,
        },
        availableData: {
          sales: coverage.hasSales,
          customers: coverage.hasCustomers,
          products: coverage.hasProducts,
          expenses: coverage.hasExpenses,
          marketing: false,
          costOfGoodsOrProfit: false,
          inventory: false,
        },
        dateCoverage: { start: coverage.minDate, end: coverage.maxDate },
        rowsProcessed: coverage.totalRows,
      };
      return {
        data,
        evidence: [
          evidence(
            "Data coverage",
            coverage.minDate && coverage.maxDate ? `${coverage.minDate} to ${coverage.maxDate}` : "No dated rows",
            coverage.totalRows > 0 ? "known" : "unknown",
          ),
        ],
        summary: `Coverage: ${coverage.totalRows} rows`,
      };
    },
  },

  getBusinessSummary: {
    describe: (a) => `Summarised business performance (${resolvePeriod(str(a, "period")).label})`,
    run: async (ctx, a) => {
      const { range, coverage, current, previous } = await periodBundle(ctx, str(a, "period"));
      const topCustomers = (await rpc(ctx, "analytics_top_customers", {
        _from: range.from,
        _to: range.to,
        _limit: 3,
      })) as Record<string, unknown>[] | null;
      const topShare =
        topCustomers?.[0] && current.revenue > 0
          ? (num(topCustomers[0]["revenue"]) / current.revenue) * 100
          : null;
      const kpis = buildOverviewKpis(current, previous, coverage);
      const health = buildBusinessHealth(current, previous, coverage, topShare);
      return {
        data: {
          period: describeRange(range),
          currency: ctx.org.currency,
          availableData: {
            sales: coverage.hasSales,
            customers: coverage.hasCustomers,
            products: coverage.hasProducts,
            expenses: coverage.hasExpenses,
          },
          current: totalsPayload(current, coverage),
          previous: previous ? totalsPayload(previous, coverage) : null,
          growth: {
            revenue: percentChange(current.revenue, previous?.revenue ?? null),
            transactions: percentChange(current.transactions, previous?.transactions ?? null),
            customers: percentChange(current.customers, previous?.customers ?? null),
            expenses: percentChange(current.expenses, previous?.expenses ?? null),
          },
          kpis: kpis.map((k) => ({
            metric: k.metric,
            value: k.value,
            previous: k.previousValue,
            changePercent: k.changePercent,
            available: k.available,
          })),
          health: { score: health.score, status: health.status, factors: health.factors },
          topCustomerRevenueSharePercent: topShare,
        },
        evidence: [
          evidence("Revenue", money(coverage.hasSales ? current.revenue : null, ctx.org.currency), coverage.hasSales ? "known" : "unknown", range.label),
          evidence("Revenue growth", pct(percentChange(current.revenue, previous?.revenue ?? null)), previous ? "known" : "unknown", range.label),
          evidence("Business health", health.score == null ? "Not available" : `${health.score}/100`, health.score == null ? "unknown" : "inferred", range.label),
        ],
        summary: `Summary for ${range.label}`,
      };
    },
  },

  getPeriodMetrics: {
    describe: (a) => `Retrieved metrics for ${resolvePeriod(str(a, "period")).label}`,
    run: async (ctx, a) => {
      const { range, coverage, current, previous } = await periodBundle(ctx, str(a, "period"));
      return {
        data: {
          period: describeRange(range),
          currency: ctx.org.currency,
          current: totalsPayload(current, coverage),
          previousPeriod: previous ? totalsPayload(previous, coverage) : null,
          notAvailable: [
            ...(coverage.hasExpenses ? [] : ["expenses"]),
            ...(coverage.hasCustomers ? [] : ["customers"]),
            ...(coverage.hasProducts ? [] : ["products"]),
            "profit",
            "margin",
            "marketing spend",
          ],
        },
        evidence: [
          evidence("Revenue", money(coverage.hasSales ? current.revenue : null, ctx.org.currency), coverage.hasSales ? "known" : "unknown", range.label),
          evidence("Transactions", coverage.hasSales ? current.transactions.toLocaleString() : "Not available", coverage.hasSales ? "known" : "unknown", range.label),
          evidence("Expenses", money(coverage.hasExpenses ? current.expenses : null, ctx.org.currency), coverage.hasExpenses ? "known" : "unknown", range.label),
        ],
        summary: `Metrics for ${range.label}`,
      };
    },
  },

  comparePeriods: {
    describe: (a) => `Compared ${resolvePeriod(str(a, "period")).label} with the previous period`,
    run: async (ctx, a) => {
      const { range, prev, coverage, current, previous } = await periodBundle(ctx, str(a, "period"));
      if (!prev || !previous) {
        return {
          data: {
            period: describeRange(range),
            comparison: null,
            reason: "A comparison needs a bounded period. 'All time' has no preceding window.",
          },
          evidence: [evidence("Comparison", "Not available", "unknown", range.label)],
          summary: "No comparable previous period",
        };
      }
      return {
        data: {
          currency: ctx.org.currency,
          currentPeriod: describeRange(range),
          previousPeriod: describeRange(prev),
          current: totalsPayload(current, coverage),
          previous: totalsPayload(previous, coverage),
          change: {
            revenuePercent: percentChange(current.revenue, previous.revenue),
            transactionsPercent: percentChange(current.transactions, previous.transactions),
            customersPercent: percentChange(current.customers, previous.customers),
            expensesPercent: percentChange(current.expenses, previous.expenses),
          },
        },
        evidence: [
          evidence("Revenue this period", money(current.revenue, ctx.org.currency), "known", describeRange(range)),
          evidence("Revenue previous period", money(previous.revenue, ctx.org.currency), "known", describeRange(prev)),
          evidence("Change", pct(percentChange(current.revenue, previous.revenue)), "known"),
        ],
        summary: `Compared ${range.label} with previous period`,
      };
    },
  },

  getRevenueTrend: {
    describe: (a) => `Loaded the revenue trend (${resolvePeriod(str(a, "period")).label})`,
    run: async (ctx, a) => {
      const range = resolvePeriod(str(a, "period"));
      const grain = str(a, "grain") ?? suggestGrain(range);
      const rows = ((await rpc(ctx, "analytics_trend", {
        _from: range.from,
        _to: range.to,
        _grain: grain,
      })) ?? []) as Record<string, unknown>[];
      const points = rows.slice(-24).map((r) => ({
        bucket: String(r["bucket"]),
        revenue: num(r["revenue"]),
        transactions: num(r["transactions"]),
        expenses: num(r["expenses"]),
      }));
      const first = points[0];
      const last = points[points.length - 1];
      return {
        data: { period: describeRange(range), grain, currency: ctx.org.currency, points },
        evidence: [
          evidence(
            "Trend",
            points.length === 0
              ? "No dated rows"
              : `${points.length} ${grain} buckets, ${money(first?.revenue ?? null, ctx.org.currency)} → ${money(last?.revenue ?? null, ctx.org.currency)}`,
            points.length ? "known" : "unknown",
            range.label,
          ),
        ],
        summary: `${points.length} trend buckets`,
      };
    },
  },

  getTopProducts: {
    describe: (a) => `Ranked products (${resolvePeriod(str(a, "period")).label})`,
    run: async (ctx, a) => {
      const range = resolvePeriod(str(a, "period"));
      const ascending = a["ascending"] === true;
      const rows = ((await rpc(ctx, "analytics_top_products", {
        _from: range.from,
        _to: range.to,
        _limit: int(a, "limit", 10),
        _ascending: ascending,
      })) ?? []) as Record<string, unknown>[];
      const products = rows.map((r) => ({
        name: String(r["name"]),
        revenue: num(r["revenue"]),
        units: num(r["units"]),
        transactions: num(r["transactions"]),
      }));
      return {
        data: { period: describeRange(range), currency: ctx.org.currency, ascending, products },
        evidence: products
          .slice(0, 3)
          .map((p) => evidence(p.name, money(p.revenue, ctx.org.currency), "known", range.label, `${p.units} units`)),
        summary: `${products.length} products`,
      };
    },
  },

  getTopCustomers: {
    describe: (a) => `Ranked customers (${resolvePeriod(str(a, "period")).label})`,
    run: async (ctx, a) => {
      const range = resolvePeriod(str(a, "period"));
      const rows = ((await rpc(ctx, "analytics_top_customers", {
        _from: range.from,
        _to: range.to,
        _limit: int(a, "limit", 10),
      })) ?? []) as Record<string, unknown>[];
      const customers = rows.map((r) => ({
        name: String(r["name"]),
        revenue: num(r["revenue"]),
        transactions: num(r["transactions"]),
      }));
      const total = customers.reduce((s, c) => s + c.revenue, 0);
      return {
        data: {
          period: describeRange(range),
          currency: ctx.org.currency,
          customers,
          topCustomerSharePercent: customers[0] && total > 0 ? (customers[0].revenue / total) * 100 : null,
        },
        evidence: customers
          .slice(0, 3)
          .map((c) =>
            evidence(c.name, money(c.revenue, ctx.org.currency), "known", range.label, `${c.transactions} transactions`),
          ),
        summary: `${customers.length} customers`,
      };
    },
  },

  getExpenseCategories: {
    describe: (a) => `Reviewed expense categories (${resolvePeriod(str(a, "period")).label})`,
    run: async (ctx, a) => {
      const range = resolvePeriod(str(a, "period"));
      const rows = ((await rpc(ctx, "analytics_expense_categories", {
        _from: range.from,
        _to: range.to,
        _limit: int(a, "limit", 12),
      })) ?? []) as Record<string, unknown>[];
      const categories = rows.map((r) => ({
        name: String(r["name"]),
        amount: num(r["amount"]),
        entries: num(r["entries"]),
      }));
      return {
        data: {
          period: describeRange(range),
          currency: ctx.org.currency,
          categories,
          note: categories.length === 0 ? "No expense data has been uploaded for this period." : null,
        },
        evidence: categories
          .slice(0, 3)
          .map((c) => evidence(c.name, money(c.amount, ctx.org.currency), "known", range.label)),
        summary: `${categories.length} expense categories`,
      };
    },
  },

  getBusinessHealth: {
    describe: (a) => `Checked business health signals (${resolvePeriod(str(a, "period")).label})`,
    run: async (ctx, a) => {
      const { range, coverage, current, previous } = await periodBundle(ctx, str(a, "period"));
      const topCustomers = (await rpc(ctx, "analytics_top_customers", {
        _from: range.from,
        _to: range.to,
        _limit: 1,
      })) as Record<string, unknown>[] | null;
      const share =
        topCustomers?.[0] && current.revenue > 0 ? (num(topCustomers[0]["revenue"]) / current.revenue) * 100 : null;
      const health = buildBusinessHealth(current, previous, coverage, share);
      const signals = detectSignals(current, previous, coverage, share);
      return {
        data: {
          period: describeRange(range),
          score: health.score,
          status: health.status,
          factors: health.factors,
          risks: signals.risks,
          opportunities: signals.opportunities,
        },
        evidence: [
          evidence("Health score", health.score == null ? "Not available" : `${health.score}/100`, health.score == null ? "unknown" : "inferred", range.label),
          ...signals.risks.slice(0, 2).map((r) => evidence("Risk", r, "inferred", range.label)),
        ],
        summary: `Health ${health.score ?? "n/a"}`,
      };
    },
  },

  getDataQuality: {
    describe: () => "Checked data quality and completeness",
    run: async (ctx) => {
      const coverage = await coverageOf(ctx);
      const score =
        coverage.totalRows === 0
          ? null
          : Math.max(
              0,
              Math.round(
                100 -
                  ((coverage.totalRows - coverage.rowsWithDate + (coverage.totalRows - coverage.rowsWithRevenue)) /
                    (coverage.totalRows * 2)) *
                    100,
              ),
            );
      return {
        data: {
          rowsProcessed: coverage.totalRows,
          rowsWithDate: coverage.rowsWithDate,
          rowsWithRevenue: coverage.rowsWithRevenue,
          rowsWithProduct: coverage.rowsWithProduct,
          rowsWithCustomer: coverage.rowsWithCustomer,
          score,
          coverageStart: coverage.minDate,
          coverageEnd: coverage.maxDate,
        },
        evidence: [
          evidence("Rows analysed", coverage.totalRows.toLocaleString(), "known"),
          evidence("Data quality", score == null ? "Not available" : `${score}/100`, score == null ? "unknown" : "known"),
        ],
        summary: `Quality ${score ?? "n/a"}`,
      };
    },
  },
};

/* -------------------------------------------- risk / opportunity signals */

export function detectSignals(
  current: PeriodTotals,
  previous: PeriodTotals | null,
  coverage: Coverage,
  topCustomerSharePercent: number | null,
): { risks: string[]; opportunities: string[] } {
  const risks: string[] = [];
  const opportunities: string[] = [];
  const revenueChange = percentChange(current.revenue, previous?.revenue ?? null);
  const txChange = percentChange(current.transactions, previous?.transactions ?? null);
  const expenseChange = percentChange(current.expenses, previous?.expenses ?? null);

  if (revenueChange != null && revenueChange < -5) {
    risks.push(`Revenue fell ${pct(revenueChange)} compared with the previous period.`);
  }
  if (txChange != null && txChange < -5) {
    risks.push(`Transaction volume fell ${pct(txChange)} compared with the previous period.`);
  }
  if (expenseChange != null && revenueChange != null && expenseChange > revenueChange + 5 && coverage.hasExpenses) {
    risks.push(`Expenses grew ${pct(expenseChange)} while revenue changed ${pct(revenueChange)}.`);
  }
  if (topCustomerSharePercent != null && topCustomerSharePercent > 30) {
    risks.push(`One customer accounts for ${topCustomerSharePercent.toFixed(0)}% of revenue in this period.`);
  }
  if (revenueChange != null && revenueChange > 10) {
    opportunities.push(`Revenue grew ${pct(revenueChange)} — worth identifying which products drove it.`);
  }
  if (txChange != null && revenueChange != null && txChange > 0 && revenueChange > txChange) {
    opportunities.push("Average order value is rising faster than order volume.");
  }
  if (current.newCustomers > 0 && coverage.hasCustomers) {
    opportunities.push(`${current.newCustomers} customers appear for the first time in this period.`);
  }
  return { risks, opportunities };
}

/* -------------------------------------------------------- prompt & schema */

export function systemPrompt(org: OrgProfile, today: string): string {
  return [
    "You are the BizIntel AI Business Analyst: a professional business intelligence analyst helping a small-business owner understand their own data and make better decisions.",
    `Business: ${org.name}. Industry: ${org.industry ?? "unspecified"}. Country: ${org.country}. Reporting currency: ${org.currency}. Today is ${today}.`,
    "",
    "ABSOLUTE RULES",
    "1. You are NOT the analytics engine. Every number you state must come from a tool result in this conversation. Never estimate, extrapolate or invent a figure.",
    "2. If a metric is not present in the tool results (for example profit, margin, cost of goods, marketing spend, stock levels), reply: 'This cannot be determined from the available data.' and say what data would be needed.",
    "3. Never claim causation from correlation. Say what changed alongside what, and state plainly that the data does not establish cause.",
    "4. Never guarantee or predict future results. Use 'suggests', 'may indicate', 'consider', 'based on the available data'.",
    "5. You only ever see this one business. If asked about another company, explain you can only analyse this business's own data.",
    "6. Speak business language, never database or technical language.",
    "",
    "CLASSIFY YOUR STATEMENTS",
    "KNOWN = directly supported by a tool result. INFERRED = a reasonable reading of those numbers, and you must label it as such ('this suggests…'). UNKNOWN = state plainly it cannot be determined.",
    "",
    "HOW TO ANSWER",
    "- Call the tools you need first; do not answer business questions from memory. Do not call tools you do not need.",
    "- When the user does not name a period, default to all available data, and state the period you used whenever it matters.",
    "- Follow-up questions refer to the period and subject already discussed; carry that context forward.",
    "- Simple factual question -> two or three sentences, no headings.",
    "- Analytical question -> use these markdown headings: '### Key Finding', '### Evidence' (bulleted numbers), '### What It Means', '### Recommended Action'.",
    "- Quote currency amounts in the business's own currency, rounded sensibly.",
    "- Recommendations must be tied to a number you actually retrieved, and framed as suggestions.",
  ].join("\n");
}

const periodProp = {
  type: ["string", "null"],
  description:
    "Period reference: today, yesterday, last7, last30, last90, this_month, prev_month, this_quarter, prev_quarter, this_year, prev_year, all. Null means all available data.",
};

function fn(name: string, description: string, props: Record<string, unknown>) {
  return {
    type: "function",
    name,
    description,
    strict: true,
    parameters: {
      type: "object",
      properties: props,
      required: Object.keys(props),
      additionalProperties: false,
    },
  };
}

export const TOOL_SCHEMAS = [
  fn("getBusinessContext", "Which datasets, fields and date range are available for this business.", {}),
  fn("getBusinessSummary", "Overall performance for a period: revenue, transactions, customers, expenses, growth and health.", { period: periodProp }),
  fn("getPeriodMetrics", "Revenue, sales, customer, product and expense totals for a period plus the preceding period.", { period: periodProp }),
  fn("comparePeriods", "Compare a period with the immediately preceding period of the same length.", { period: periodProp }),
  fn("getRevenueTrend", "Revenue, transaction and expense values bucketed over time.", {
    period: periodProp,
    grain: { type: ["string", "null"], enum: ["day", "week", "month", "quarter", "year", null], description: "Bucket size; null picks a sensible one." },
  }),
  fn("getTopProducts", "Products ranked by revenue for a period.", {
    period: periodProp,
    limit: { type: ["integer", "null"], description: "How many products, max 25." },
    ascending: { type: ["boolean", "null"], description: "True returns the weakest products first." },
  }),
  fn("getTopCustomers", "Customers ranked by revenue for a period.", {
    period: periodProp,
    limit: { type: ["integer", "null"], description: "How many customers, max 25." },
  }),
  fn("getExpenseCategories", "Expense totals by category for a period.", {
    period: periodProp,
    limit: { type: ["integer", "null"], description: "How many categories, max 25." },
  }),
  fn("getBusinessHealth", "Business health score, contributing factors, evidence-based risks and opportunities.", { period: periodProp }),
  fn("getDataQuality", "Completeness of the uploaded data: rows processed, missing dates or values, coverage.", {}),
];

/* ------------------------------------------------------------- model call */

type ResponseItem = Record<string, unknown>;

class GatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function callGateway(apiKey: string, input: ResponseItem[], instructions: string) {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: ANALYST_MODEL,
      instructions,
      input,
      tools: TOOL_SCHEMAS,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new GatewayError(res.status, text.slice(0, 500));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: Record<string, unknown> | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as Record<string, unknown>;
          if (event["type"] === "response.completed" || event["type"] === "response.incomplete") {
            completed = event["response"] as Record<string, unknown>;
          }
        } catch {
          /* ignore keep-alive fragments */
        }
      }
    }
  }

  if (!completed) throw new GatewayError(502, "The analysis stream ended before a result arrived.");
  return completed;
}

export type AnalystTurn = { role: "user" | "assistant"; content: string };

export type AnalystResult = {
  answer: string;
  evidence: AiEvidence[];
  toolCalls: AiToolCallRecord[];
  usage: { inputTokens: number; outputTokens: number; durationMs: number };
};

export class AnalystUnavailable extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.status = status;
  }
}

/** Runs one analyst turn: model -> approved tools -> model -> answer. */
export async function runAnalyst(params: {
  ctx: ToolContext;
  history: AnalystTurn[];
  question: string;
  apiKey: string;
  onToolCall?: (record: AiToolCallRecord & { durationMs: number; args: Record<string, unknown> }) => void;
}): Promise<AnalystResult> {
  const started = Date.now();
  const instructions = systemPrompt(params.ctx.org, new Date().toISOString().slice(0, 10));

  const input: ResponseItem[] = [
    ...params.history.slice(-12).map((m) => ({
      type: "message",
      role: m.role,
      content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }],
    })),
    { type: "message", role: "user", content: [{ type: "input_text", text: params.question }] },
  ];

  const evidenceOut: AiEvidence[] = [];
  const toolCalls: AiToolCallRecord[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    let response: Record<string, unknown>;
    try {
      response = await callGateway(params.apiKey, input, instructions);
    } catch (error) {
      const status = error instanceof GatewayError ? error.status : 503;
      console.error("[analyst] gateway failure", status, error);
      if (status === 429) throw new AnalystUnavailable("The AI analyst is busy right now. Please try again in a moment.", 429);
      if (status === 402 || status === 403)
        throw new AnalystUnavailable("AI analysis is temporarily unavailable for this workspace. Your analytics are still available.", status);
      throw new AnalystUnavailable("AI analysis is temporarily unavailable. Your underlying analytics are still available.");
    }

    const usage = (response["usage"] ?? {}) as Record<string, unknown>;
    inputTokens += num(usage["input_tokens"]);
    outputTokens += num(usage["output_tokens"]);

    const output = (response["output"] ?? []) as ResponseItem[];
    const calls = output.filter((item) => item["type"] === "function_call");

    // Reasoning items are not persisted (store:false) and are not needed again.
    const carried = output.filter((item) => item["type"] !== "reasoning");
    input.push(...carried);

    if (calls.length === 0) {
      const answer = collectText(output);
      return {
        answer: answer || "I could not produce an analysis for that question. Please try rephrasing it.",
        evidence: evidenceOut,
        toolCalls,
        usage: { inputTokens, outputTokens, durationMs: Date.now() - started },
      };
    }

    for (const call of calls) {
      const name = String(call["name"] ?? "");
      const callId = String(call["call_id"] ?? "");
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(String(call["arguments"] ?? "{}")) as Record<string, unknown>;
      } catch {
        args = {};
      }

      const tool = TOOLS[name];
      if (!tool) {
        input.push({
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({ error: `Tool ${name} is not available.` }),
        });
        continue;
      }

      const toolStarted = Date.now();
      try {
        const outcome = await tool.run(params.ctx, args);
        const record: AiToolCallRecord = { tool: name, arguments: args, summary: tool.describe(args) };
        toolCalls.push(record);
        for (const item of outcome.evidence) {
          if (!evidenceOut.some((e) => e.label === item.label && e.value === item.value)) evidenceOut.push(item);
        }
        params.onToolCall?.({ ...record, durationMs: Date.now() - toolStarted, args });
        input.push({
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(outcome.data),
        });
      } catch (error) {
        console.error("[analyst] tool failure", name, error);
        input.push({
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({ error: "That analysis could not be calculated from the available data." }),
        });
      }
    }
  }

  throw new AnalystUnavailable("That question needed too many steps to analyse. Please ask it in a more specific way.");
}

function collectText(output: ResponseItem[]): string {
  const parts: string[] = [];
  for (const item of output) {
    if (item["type"] !== "message") continue;
    const content = (item["content"] ?? []) as Record<string, unknown>[];
    for (const part of content) {
      if (part["type"] === "output_text" && typeof part["text"] === "string") parts.push(part["text"]);
    }
  }
  return parts.join("\n").trim();
}
