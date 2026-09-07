/** Phase 5 — structured report model. Browser-safe types only. */
import type {
  AnalyticsDateRange,
  BusinessHealth,
  Coverage,
  CustomerRow,
  DataQualitySummary,
  ExpenseCategoryRow,
  Grain,
  PeriodTotals,
  ProductRow,
  TrendPoint,
} from "@/lib/analytics/types";
import type { AiEvidence, BriefingSection } from "@/lib/ai/types";

export type ReportType = "executive" | "sales" | "customers" | "products" | "expenses";

export type ReportStatus = "queued" | "generating" | "completed" | "failed";

export const REPORT_TYPES: {
  key: ReportType;
  label: string;
  description: string;
  requires?: "expenses" | "customers" | "products";
}[] = [
  {
    key: "executive",
    label: "Executive Report",
    description: "Full business overview: performance, health, findings, risks and actions.",
  },
  {
    key: "sales",
    label: "Sales Report",
    description: "Revenue, transactions, units, average order value and sales trends.",
  },
  {
    key: "customers",
    label: "Customer Report",
    description: "Customer counts, top customers, contribution and concentration.",
    requires: "customers",
  },
  {
    key: "products",
    label: "Product Report",
    description: "Best and weakest products, units sold and revenue contribution.",
    requires: "products",
  },
  {
    key: "expenses",
    label: "Expense Report",
    description: "Total expenses, categories and the expense-to-revenue relationship.",
    requires: "expenses",
  },
];

export type ReportKpi = {
  label: string;
  value: number | null;
  format: "currency" | "number" | "percent";
  changePercent: number | null;
  hint: string;
  unavailableReason?: string;
};

export type ReportTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type ReportTableRow = Record<string, string | number | null>;

export type ReportFinding = {
  title: string;
  evidence: string;
  significance?: string;
  nextStep?: string;
};

export type ReportSection =
  | { id: string; title: string; type: "text"; content: { paragraphs: string[] } }
  | { id: string; title: string; type: "kpi"; content: { items: ReportKpi[] } }
  | {
      id: string;
      title: string;
      type: "chart";
      content: {
        question: string;
        dataKey: "revenue" | "transactions" | "units" | "expenses";
        valueKind: "currency" | "number";
        kind: "area" | "bar" | "line";
        grain: Grain;
        points: TrendPoint[];
      };
    }
  | {
      id: string;
      title: string;
      type: "table";
      content: {
        columns: ReportTableColumn[];
        rows: ReportTableRow[];
        note?: string;
        csvKey?: string;
      };
    }
  | { id: string; title: string; type: "findings"; content: { items: ReportFinding[] } }
  | { id: string; title: string; type: "unavailable"; content: { reason: string } };

export type ReportDataQuality = DataQualitySummary & {
  datasets: { name: string; rows: number; status: string }[];
};

export type ReportDocument = {
  version: 1;
  organizationId: string;
  organizationName: string;
  logoUrl: string | null;
  currency: string;
  country: string;
  industry: string | null;
  title: string;
  reportType: ReportType;
  periodKey: string;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  generatedAt: string;
  summary: string[];
  sections: ReportSection[];
  findings: ReportFinding[];
  risks: ReportFinding[];
  opportunities: ReportFinding[];
  recommendations: ReportFinding[];
  limitations: string[];
  dataQuality: ReportDataQuality;
  ai: {
    included: boolean;
    summary: string | null;
    sections: BriefingSection[];
    evidence: AiEvidence[];
    unavailableReason: string | null;
  };
};

export type ReportListItem = {
  id: string;
  title: string;
  report_type: ReportType;
  period_key: string;
  period_start: string | null;
  period_end: string | null;
  status: ReportStatus;
  include_ai: boolean;
  created_at: string;
  duration_ms: number | null;
  error_message: string | null;
};

export type ReportRecord = ReportListItem & {
  organization_id: string;
  created_by: string;
  content: ReportDocument | null;
};

/** Everything the pure report builders need. Collected server-side from Phase 3 analytics. */
export type ReportInput = {
  organization: {
    id: string;
    name: string;
    industry: string | null;
    country: string;
    currency: string;
    logoUrl: string | null;
  };
  range: AnalyticsDateRange;
  previousRange: AnalyticsDateRange | null;
  grain: Grain;
  coverage: Coverage;
  current: PeriodTotals;
  previous: PeriodTotals | null;
  trend: TrendPoint[];
  topProducts: ProductRow[];
  weakProducts: ProductRow[];
  topCustomers: CustomerRow[];
  expenseCategories: ExpenseCategoryRow[];
  health: BusinessHealth;
  quality: ReportDataQuality;
  ai: {
    included: boolean;
    summary: string | null;
    sections: BriefingSection[];
    evidence: AiEvidence[];
    unavailableReason: string | null;
  };
  generatedAt: string;
};
