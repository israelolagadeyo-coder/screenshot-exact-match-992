import { describe, expect, it } from "vitest";
import { buildBusinessHealth, percentChange, safeDivide, trendOf } from "./calc";
import { buildRange, previousRange, suggestGrain } from "./dates";
import type { Coverage, PeriodTotals } from "./types";

const totals = (over: Partial<PeriodTotals> = {}): PeriodTotals => ({
  revenue: 0,
  transactions: 0,
  units: 0,
  expenses: 0,
  expenseEntries: 0,
  customers: 0,
  newCustomers: 0,
  products: 0,
  days: 0,
  periodStart: null,
  periodEnd: null,
  ...over,
});

const coverage = (over: Partial<Coverage> = {}): Coverage => ({
  minDate: null,
  maxDate: null,
  salesRows: 0,
  expenseRows: 0,
  customerRows: 0,
  rowsWithDate: 0,
  rowsWithRevenue: 0,
  rowsWithProduct: 0,
  rowsWithCustomer: 0,
  totalRows: 0,
  hasSales: true,
  hasExpenses: false,
  hasCustomers: false,
  hasProducts: false,
  ...over,
});

describe("growth", () => {
  it("calculates percentage change", () => {
    expect(percentChange(1_200_000, 1_000_000)).toBeCloseTo(20);
  });
  it("returns null instead of Infinity when the previous period is zero", () => {
    expect(percentChange(500, 0)).toBeNull();
    expect(trendOf(500, 0)).toBe("new");
  });
  it("returns not_available when data is missing", () => {
    expect(trendOf(null, 10)).toBe("not_available");
  });
  it("never divides by zero", () => {
    expect(safeDivide(100, 0)).toBeNull();
  });
});

describe("date ranges", () => {
  const today = new Date("2026-03-15T00:00:00");
  it("builds the last 30 days inclusively", () => {
    const r = buildRange("last30", today);
    expect(r.from).toBe("2026-02-14");
    expect(r.to).toBe("2026-03-15");
  });
  it("derives the preceding window of equal length", () => {
    const prev = previousRange(buildRange("this_month", today));
    expect(prev?.from).toBe("2026-01-29");
    expect(prev?.to).toBe("2026-02-28");
  });
  it("has no comparison window for all-time", () => {
    expect(previousRange(buildRange("all", today))).toBeNull();
  });
  it("chooses a readable bucket size", () => {
    expect(suggestGrain(buildRange("last7", today))).toBe("day");
    expect(suggestGrain(buildRange("this_year", today))).toBe("month");
  });
});

describe("business health", () => {
  it("is unavailable without a comparable previous period", () => {
    const h = buildBusinessHealth(totals({ revenue: 100 }), null, coverage(), null);
    expect(h.score).toBeNull();
  });
  it("explains every factor it scores", () => {
    const h = buildBusinessHealth(
      totals({ revenue: 120, transactions: 12 }),
      totals({ revenue: 100, transactions: 10 }),
      coverage(),
      null,
    );
    expect(h.score).not.toBeNull();
    expect(h.factors.length).toBeGreaterThan(0);
  });
});
