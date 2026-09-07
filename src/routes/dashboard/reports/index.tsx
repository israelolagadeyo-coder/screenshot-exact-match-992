import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ReportWizard } from "@/components/reports/ReportWizard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrg } from "@/lib/org-context";
import { formatReportDateTime } from "@/lib/reports/formatting";
import { deleteReport, listReports } from "@/lib/reports/reports.functions";
import { REPORT_TYPES, type ReportType } from "@/lib/reports/types";

export const Route = createFileRoute("/dashboard/reports/")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Business reports — BizIntel AI" },
      {
        name: "description",
        content: "Generate executive, sales, customer, product and expense reports from your business data.",
      },
      { property: "og:title", content: "Business reports — BizIntel AI" },
      {
        property: "og:description",
        content: "Turn your analytics and AI analysis into a shareable business report.",
      },
    ],
  }),
});

function ReportsPage() {
  const { organization, role } = useOrg();
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [reportType, setReportType] = useState<ReportType | "all">("all");

  const orgId = organization?.id ?? "";
  const canGenerate = role !== "viewer";

  const reports = useQuery({
    queryKey: ["reports", orgId, reportType, search],
    enabled: Boolean(orgId),
    queryFn: () => listReports({ data: { organizationId: orgId, reportType, search } }),
  });

  const removal = useMutation({
    mutationFn: (reportId: string) => deleteReport({ data: { reportId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports", orgId] });
      toast.success("Report deleted.");
    },
    onError: (error: Error) => toast.error(error.message || "We couldn't delete that report."),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Turn your data, analytics and AI analysis into a report you can share."
        action={
          canGenerate ? (
            <Button onClick={() => setWizardOpen(true)}>Generate Business Report</Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reports"
          aria-label="Search reports"
          className="max-w-xs"
        />
        <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType | "all")}>
          <SelectTrigger className="w-[200px]" aria-label="Report type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All report types</SelectItem>
            {REPORT_TYPES.map((type) => (
              <SelectItem key={type.key} value={type.key}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {reports.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your reports…</p>
      ) : (reports.data ?? []).length === 0 ? (
        <div className="panel p-8 text-center">
          <h2 className="font-display text-lg font-semibold">No reports yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate your first report to see your business performance written out in full.
          </p>
          {canGenerate ? (
            <Button className="mt-4" onClick={() => setWizardOpen(true)}>
              Generate Business Report
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {(reports.data ?? []).map((report) => (
            <li key={report.id} className="panel flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <Link
                  to="/dashboard/reports/$reportId"
                  params={{ reportId: report.id }}
                  className="font-medium hover:underline"
                >
                  {report.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatReportDateTime(report.created_at)}
                  {report.include_ai ? " · includes AI analysis" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={report.status === "completed" ? "secondary" : "outline"}>{report.status}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removal.mutate(report.id)}
                  disabled={removal.isPending}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {orgId ? (
        <ReportWizard
          organizationId={orgId}
          canGenerate={canGenerate}
          open={wizardOpen}
          onOpenChange={setWizardOpen}
        />
      ) : null}
    </div>
  );
}
