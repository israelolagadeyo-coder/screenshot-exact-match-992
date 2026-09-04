export type Grain = "day" | "week" | "month" | "quarter" | "year";

export type DateRangePresetKey =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "last90"
  | "this_month"
  | "prev_month"
  | "this_quarter"
  | "prev_quarter"
  | "this_year"
  | "prev_year"
  | "all"
  | "custom";

export type AnalyticsDateRange = {
  key: DateRangePresetKey;
  label: string;
  /** ISO yyyy-MM-dd, inclusive. Null means unbounded. */
  from: string | null;
  to: string | null;
};

export type TrendDirection = "up" | "down" | "flat" | "new" | "not_available";

export type KPI = {
  metric: string;
  label: string;
  value: number | null;
  previousValue: number | null;
  changePercent: number | null;
  trend: TrendDirection;
  format: "currency" | "number" | "percent";
  hint: string;
  available: boolean;
  unavailableReason?: string;
};

export type PeriodTotals = {
  revenue: number;
  transactions: number;
  units: number;
  expenses: number;
  expenseEntries: number;
  customers: number;
  newCustomers: number;
  products: number;
  days: number;
  periodStart: string | null;
  periodEnd: string | null;
};

export type Coverage = {
  minDate: string | null;
  maxDate: string | null;
  salesRows: number;
  expenseRows: number;
  customerRows: number;
  rowsWithDate: number;
  rowsWithRevenue: number;
  rowsWithProduct: number;
  rowsWithCustomer: number;
  totalRows: number;
  hasSales: boolean;
  hasExpenses: boolean;
  hasCustomers: boolean;
  hasProducts: boolean;
};

export type TrendPoint = {
  bucket: string;
  revenue: number;
  transactions: number;
  units: number;
  expenses: number;
};

export type ProductRow = {
  name: string;
  revenue: number;
  units: number;
  transactions: number;
};

export type CustomerRow = {
  name: string;
  revenue: number;
  transactions: number;
};

export type ExpenseCategoryRow = {
  name: string;
  amount: number;
  entries: number;
};

export type HealthFactor = {
  label: string;
  detail: string;
  kind: "positive" | "warning" | "neutral";
};

export type BusinessHealth = {
  score: number | null;
  status: string;
  factors: HealthFactor[];
};

export type DataQualitySummary = {
  score: number | null;
  rowsProcessed: number;
  rowsWithDate: number;
  rowsWithRevenue: number;
  missingDates: number;
  missingRevenue: number;
  duplicates: number;
  invalidValues: number;
  availableMetrics: string[];
  unavailableMetrics: string[];
};

/** Structured fact shape consumed later by the AI Business Analyst (Phase 4). */
export type AnalyticsFact = {
  metric: string;
  value: number | null;
  unit: "currency" | "count" | "percent";
  period: string;
  previousPeriod: string | null;
  source: "datasets";
  confidence: "known" | "inferred" | "unknown";
  note?: string;
};
