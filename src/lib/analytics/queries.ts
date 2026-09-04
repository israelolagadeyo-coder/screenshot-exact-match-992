import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AnalyticsDateRange,
  Coverage,
  CustomerRow,
  ExpenseCategoryRow,
  Grain,
  PeriodTotals,
  ProductRow,
  TrendPoint,
} from "./types";

/**
 * All analytics run as database functions with security invoker, so Row Level Security
 * decides what the signed-in user may read. An organisation id from the browser can never
 * unlock another organisation's rows.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase as any).rpc(name, args);

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

function toTotals(raw: Record<string, unknown> | null): PeriodTotals {
  const r = raw ?? {};
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

export function coverageQuery(orgId: string | undefined) {
  return queryOptions({
    queryKey: ["analytics", orgId, "coverage"],
    enabled: Boolean(orgId),
    staleTime: 60_000,
    queryFn: async (): Promise<Coverage> => {
      const { data, error } = await rpc("analytics_coverage", { _org: orgId });
      if (error) throw error;
      const r = (data ?? {}) as Record<string, unknown>;
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
    },
  });
}

export function periodQuery(orgId: string | undefined, range: AnalyticsDateRange | null) {
  return queryOptions({
    queryKey: ["analytics", orgId, "period", range?.from ?? null, range?.to ?? null],
    enabled: Boolean(orgId) && range !== null,
    staleTime: 60_000,
    queryFn: async (): Promise<PeriodTotals> => {
      const { data, error } = await rpc("analytics_period", {
        _org: orgId,
        _from: range?.from ?? null,
        _to: range?.to ?? null,
      });
      if (error) throw error;
      return toTotals(data as Record<string, unknown> | null);
    },
  });
}

export function trendQuery(
  orgId: string | undefined,
  range: AnalyticsDateRange,
  grain: Grain,
) {
  return queryOptions({
    queryKey: ["analytics", orgId, "trend", range.from, range.to, grain],
    enabled: Boolean(orgId),
    staleTime: 60_000,
    queryFn: async (): Promise<TrendPoint[]> => {
      const { data, error } = await rpc("analytics_trend", {
        _org: orgId,
        _from: range.from,
        _to: range.to,
        _grain: grain,
      });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        bucket: String(row["bucket"]),
        revenue: num(row["revenue"]),
        transactions: num(row["transactions"]),
        units: num(row["units"]),
        expenses: num(row["expenses"]),
      }));
    },
  });
}

export function topProductsQuery(
  orgId: string | undefined,
  range: AnalyticsDateRange,
  limit = 10,
  ascending = false,
) {
  return queryOptions({
    queryKey: ["analytics", orgId, "products", range.from, range.to, limit, ascending],
    enabled: Boolean(orgId),
    staleTime: 60_000,
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await rpc("analytics_top_products", {
        _org: orgId,
        _from: range.from,
        _to: range.to,
        _limit: limit,
        _ascending: ascending,
      });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        name: String(row["name"]),
        revenue: num(row["revenue"]),
        units: num(row["units"]),
        transactions: num(row["transactions"]),
      }));
    },
  });
}

export function topCustomersQuery(
  orgId: string | undefined,
  range: AnalyticsDateRange,
  limit = 10,
) {
  return queryOptions({
    queryKey: ["analytics", orgId, "customers", range.from, range.to, limit],
    enabled: Boolean(orgId),
    staleTime: 60_000,
    queryFn: async (): Promise<CustomerRow[]> => {
      const { data, error } = await rpc("analytics_top_customers", {
        _org: orgId,
        _from: range.from,
        _to: range.to,
        _limit: limit,
      });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        name: String(row["name"]),
        revenue: num(row["revenue"]),
        transactions: num(row["transactions"]),
      }));
    },
  });
}

export function expenseCategoriesQuery(
  orgId: string | undefined,
  range: AnalyticsDateRange,
  limit = 12,
) {
  return queryOptions({
    queryKey: ["analytics", orgId, "expenses", range.from, range.to, limit],
    enabled: Boolean(orgId),
    staleTime: 60_000,
    queryFn: async (): Promise<ExpenseCategoryRow[]> => {
      const { data, error } = await rpc("analytics_expense_categories", {
        _org: orgId,
        _from: range.from,
        _to: range.to,
        _limit: limit,
      });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        name: String(row["name"]),
        amount: num(row["amount"]),
        entries: num(row["entries"]),
      }));
    },
  });
}
