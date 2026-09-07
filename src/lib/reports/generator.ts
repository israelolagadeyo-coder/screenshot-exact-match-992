/**
 * Pure report assembly. Takes a collected analytics bundle (Phase 3) plus an optional
 * AI analysis (Phase 4) and produces a structured report document. No I/O here, so the
 * builders are directly testable.
 */
import { describeRange } from "@/lib/analytics/dates";
import { buildCustomerSections, customerSummary } from "./customers";
import { buildExecutiveSections, executiveSummary } from "./executive";
import { buildExpenseSections, expenseSummary } from "./expenses";
import { buildProductSections, productSummary } from "./products";
import { buildSalesSections, salesSummary } from "./sales";
import {
  buildFindings,
  buildLimitations,
  buildOpportunities,
  buildRecommendations,
  buildRisks,
} from "./sections";
import { REPORT_TYPES, type ReportDocument, type ReportInput, type ReportType } from "./types";

export function reportTypeLabel(type: ReportType): string {
  return REPORT_TYPES.find((t) => t.key === type)?.label ?? "Business Report";
}

export function defaultReportTitle(type: ReportType, periodLabel: string): string {
  const base: Record<ReportType, string> = {
    executive: "Executive Business Report",
    sales: "Sales Performance Report",
    customers: "Customer Performance Report",
    products: "Product Performance Report",
    expenses: "Expense Report",
  };
  return `${base[type]} — ${periodLabel}`;
}

export function buildReport(input: ReportInput, type: ReportType, title?: string): ReportDocument {
  const summary =
    type === "executive"
      ? executiveSummary(input)
      : type === "sales"
        ? salesSummary(input)
        : type === "customers"
          ? customerSummary(input)
          : type === "products"
            ? productSummary(input)
            : expenseSummary(input);

  const sections =
    type === "executive"
      ? buildExecutiveSections(input)
      : type === "sales"
        ? buildSalesSections(input)
        : type === "customers"
          ? buildCustomerSections(input)
          : type === "products"
            ? buildProductSections(input)
            : buildExpenseSections(input);

  const findings = buildFindings(input);
  const risks = buildRisks(input);
  const opportunities = buildOpportunities(input);
  const recommendations = buildRecommendations(input, risks, opportunities);

  return {
    version: 1,
    organizationId: input.organization.id,
    organizationName: input.organization.name,
    logoUrl: input.organization.logoUrl,
    currency: input.organization.currency,
    country: input.organization.country,
    industry: input.organization.industry,
    title: title?.trim() || defaultReportTitle(type, input.range.label),
    reportType: type,
    periodKey: input.range.key,
    periodLabel: describeRange(input.range),
    periodStart: input.range.from,
    periodEnd: input.range.to,
    generatedAt: input.generatedAt,
    summary,
    sections,
    findings,
    risks,
    opportunities,
    recommendations,
    limitations: buildLimitations(input),
    dataQuality: input.quality,
    ai: input.ai,
  };
}
