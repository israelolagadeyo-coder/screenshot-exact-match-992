/** CSV export helpers. Pure, so exports never re-query the database. */
import type { ReportDocument, ReportTableColumn, ReportTableRow } from "./types";

function escapeCell(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: ReportTableColumn[], rows: ReportTableRow[]): string {
  const head = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(row[c.key] ?? "")).join(","));
  return [head, ...body].join("\r\n");
}

export type CsvExport = { key: string; label: string; filename: string; csv: string };

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export function reportCsvExports(report: ReportDocument): CsvExport[] {
  const out: CsvExport[] = [];
  const base = slug(`${report.organizationName}-${report.title}`);

  const kpiSection = report.sections.find((s) => s.type === "kpi");
  if (kpiSection && kpiSection.type === "kpi") {
    out.push({
      key: "kpis",
      label: "KPI summary",
      filename: `${base}-kpis.csv`,
      csv: toCsv(
        [
          { key: "metric", label: "Metric" },
          { key: "value", label: "Value" },
          { key: "change", label: "Change vs previous period" },
        ],
        kpiSection.content.items.map((item) => ({
          metric: item.label,
          value: item.value == null ? "Not available" : item.value,
          change: item.changePercent == null ? "Not available" : `${item.changePercent.toFixed(1)}%`,
        })),
      ),
    });
  }

  for (const section of report.sections) {
    if (section.type !== "table") continue;
    out.push({
      key: section.id,
      label: section.title,
      filename: `${base}-${slug(section.title)}.csv`,
      csv: toCsv(section.content.columns, section.content.rows),
    });
  }

  return out;
}
