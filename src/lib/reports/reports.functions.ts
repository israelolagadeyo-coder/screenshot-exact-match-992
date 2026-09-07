/**
 * Phase 5 report server functions.
 *
 * Every call is authenticated and the organisation is resolved through the caller's own
 * membership (RLS) — the browser can never widen access by sending another organisation id.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OrgRole } from "@/lib/organizations";
import type { ReportDocument, ReportListItem, ReportRecord, ReportType } from "./types";

const FRIENDLY_ERROR = "We couldn't generate that report. Please try again in a moment.";

const REPORT_TYPE_KEYS: ReportType[] = ["executive", "sales", "customers", "products", "expenses"];

type OrgInput = { organizationId: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function resolveOrg(supabase: Db, organizationId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, industry, country, currency, logo_url")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) throw new Error("You do not have access to this business.");
  return data as {
    id: string;
    name: string;
    industry: string | null;
    country: string;
    currency: string;
    logo_url: string | null;
  };
}

async function roleIn(supabase: Db, organizationId: string, userId: string): Promise<OrgRole> {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("You do not have access to this business.");
  return data.role as OrgRole;
}

function assertCanCreate(role: OrgRole) {
  if (role === "viewer") {
    throw new Error("Viewers can read and download reports, but cannot generate new ones.");
  }
}

export const listReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: OrgInput & { reportType?: ReportType | "all"; status?: string; search?: string }) => input,
  )
  .handler(async ({ data, context }): Promise<ReportListItem[]> => {
    await resolveOrg(context.supabase, data.organizationId);
    let query = context.supabase
      .from("reports")
      .select(
        "id, title, report_type, period_key, period_start, period_end, status, include_ai, created_at, duration_ms, error_message",
      )
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (data.reportType && data.reportType !== "all") query = query.eq("report_type", data.reportType);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.search?.trim()) query = query.ilike("title", `%${data.search.trim()}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error("We couldn't load your reports.");
    return (rows ?? []) as ReportListItem[];
  });

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string }) => input)
  .handler(async ({ data, context }): Promise<ReportRecord> => {
    const { data: row, error } = await context.supabase
      .from("reports")
      .select("*")
      .eq("id", data.reportId)
      .maybeSingle();
    if (error || !row) throw new Error("That report is not available.");
    return {
      ...(row as ReportRecord),
      content: (row.content && Object.keys(row.content).length > 0 ? row.content : null) as ReportDocument | null,
    };
  });

export const deleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error, count } = await context.supabase
      .from("reports")
      .delete({ count: "exact" })
      .eq("id", data.reportId);
    if (error) throw new Error("We couldn't delete that report.");
    if (!count) throw new Error("You do not have permission to delete this report.");
    return { ok: true };
  });

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: OrgInput & {
      reportType: ReportType;
      periodKey: string;
      includeAi: boolean;
      title?: string;
    }) => {
      if (!REPORT_TYPE_KEYS.includes(input.reportType)) throw new Error("Please choose a valid report type.");
      if (!input.periodKey) throw new Error("Please choose a reporting period.");
      return input;
    },
  )
  .handler(async ({ data, context }): Promise<{ reportId: string }> => {
    const { supabase, userId } = context;
    const org = await resolveOrg(supabase, data.organizationId);
    assertCanCreate(await roleIn(supabase, org.id, userId));

    // Guard against runaway generation loops.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .gte("created_at", since);
    if ((count ?? 0) >= 6) {
      throw new Error("You're generating reports faster than we can build them. Please wait a moment.");
    }

    const { resolvePeriod } = await import("@/lib/ai/engine.server");
    const range = resolvePeriod(data.periodKey);
    const { defaultReportTitle } = await import("./generator");
    const title = data.title?.trim() || defaultReportTitle(data.reportType, range.label);

    const { data: created, error: createError } = await supabase
      .from("reports")
      .insert({
        organization_id: org.id,
        created_by: userId,
        title,
        report_type: data.reportType,
        period_key: range.key,
        period_start: range.from,
        period_end: range.to,
        status: "generating",
        include_ai: data.includeAi,
      })
      .select("id")
      .single();
    if (createError || !created) throw new Error(FRIENDLY_ERROR);

    const reportId = created.id as string;
    const started = Date.now();

    try {
      const { collectReportInput } = await import("./collect.server");
      const { buildReport } = await import("./generator");
      const input = await collectReportInput(
        { supabase, orgId: org.id, org: { ...org, id: org.id } },
        data.periodKey,
        data.includeAi,
        process.env["LOVABLE_API_KEY"],
      );
      const document = buildReport(input, data.reportType, title);
      const duration = Date.now() - started;

      const { error: updateError } = await supabase
        .from("reports")
        .update({ status: "completed", content: document, duration_ms: duration })
        .eq("id", reportId);
      if (updateError) throw updateError;

      console.info(`[reports] generated ${data.reportType} in ${duration}ms`);
      return { reportId };
    } catch (error) {
      console.error("[reports] generation failed", error instanceof Error ? error.message : "unknown error");
      await supabase
        .from("reports")
        .update({
          status: "failed",
          duration_ms: Date.now() - started,
          error_message: "Report generation failed while reading your analytics.",
        })
        .eq("id", reportId);
      throw new Error(FRIENDLY_ERROR);
    }
  });
