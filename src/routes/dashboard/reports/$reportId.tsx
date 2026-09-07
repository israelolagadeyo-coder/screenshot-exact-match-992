import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ReportDocumentView } from "@/components/reports/ReportDocumentView";
import { getReport } from "@/lib/reports/reports.functions";
import { reportCsvExports } from "@/lib/reports/csv";

export const Route = createFileRoute("/dashboard/reports/$reportId")({
  component: ReportDetailPage,
  head: () => ({
    meta: [
      { title: "Business report — BizIntel AI" },
      { name: "description", content: "Read, print and export a generated business report." },
      { property: "og:title", content: "Business report — BizIntel AI" },
      { property: "og:description", content: "Read, print and export a generated business report." },
    ],
  }),
});

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ReportDetailPage() {
  const { reportId } = useParams({ from: "/dashboard/reports/$reportId" });
  const query = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport({ data: { reportId } }),
  });

  const record = query.data;
  const document_ = record?.content ?? null;
  const exports = document_ ? reportCsvExports(document_) : [];

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard/reports">← All reports</Link>
        </Button>
        {document_ ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Download PDF
            </Button>
            {exports.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exports.forEach((e) => download(e.filename, e.csv))}
              >
                Export CSV
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your report…</p>
      ) : query.isError ? (
        <p className="panel p-6 text-sm text-muted-foreground">
          That report is not available. It may have been deleted, or belong to another business.
        </p>
      ) : !document_ ? (
        <p className="panel p-6 text-sm text-muted-foreground">
          {record?.error_message ??
            "This report is still being generated. Refresh in a moment to see the finished version."}
        </p>
      ) : (
        <div className="panel p-6 sm:p-10">
          <ReportDocumentView report={document_} />
        </div>
      )}
    </div>
  );
}
