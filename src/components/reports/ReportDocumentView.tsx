import { AlertTriangle, CheckCircle2, Info, Lightbulb } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendChart } from "@/components/analytics/TrendChart";
import { formatKpiValue, formatNumber, formatPercent, formatReportDateTime } from "@/lib/reports/formatting";
import type { ReportDocument, ReportFinding, ReportSection } from "@/lib/reports/types";

function SectionHeading({ children }: { children: string }) {
  return <h2 className="report-heading font-display text-xl font-semibold">{children}</h2>;
}

function FindingList({ items, icon: Icon }: { items: ReportFinding[]; icon: typeof Info }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing material was identified for this period.</p>;
  }
  return (
    <ol className="space-y-4">
      {items.map((item, i) => (
        <li key={item.title} className="rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">
                {items.length > 1 ? `${i + 1}. ` : ""}
                {item.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{item.evidence}</p>
              {item.significance ? (
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Significance: {item.significance}
                </p>
              ) : null}
              {item.nextStep ? <p className="mt-2 text-sm">Suggested next step: {item.nextStep}</p> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SectionBody({ section, currency }: { section: ReportSection; currency: string }) {
  if (section.type === "text") {
    return (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        {section.content.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    );
  }

  if (section.type === "unavailable") {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        {section.content.reason}
      </p>
    );
  }

  if (section.type === "kpi") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {section.content.items.map((item) => (
          <div key={item.label} className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{formatKpiValue(item, currency)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.value == null
                ? (item.unavailableReason ?? "Not available")
                : item.changePercent == null
                  ? item.hint
                  : `${formatPercent(item.changePercent)} vs previous period`}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === "chart") {
    if (section.content.points.length === 0) {
      return <p className="text-sm text-muted-foreground">Not enough dated rows to draw this chart.</p>;
    }
    return (
      <div>
        <p className="mb-3 text-sm text-muted-foreground">{section.content.question}</p>
        <TrendChart
          data={section.content.points}
          grain={section.content.grain}
          dataKey={section.content.dataKey}
          kind={section.content.kind}
          currency={currency}
          valueKind={section.content.valueKind}
          label={section.title}
        />
      </div>
    );
  }

  if (section.type === "findings") {
    return <FindingList items={section.content.items} icon={Info} />;
  }

  if (section.content.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No rows are available for this table in the selected period.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {section.content.columns.map((col) => (
            <TableHead key={col.key} className={col.align === "right" ? "text-right" : undefined}>
              {col.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {section.content.rows.map((row, i) => (
          <TableRow key={`${section.id}-${i}`}>
            {section.content.columns.map((col) => (
              <TableCell key={col.key} className={col.align === "right" ? "text-right tabular-nums" : undefined}>
                {row[col.key] ?? "—"}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ReportDocumentView({ report }: { report: ReportDocument }) {
  const currency = report.currency;

  return (
    <article className="report-document space-y-10">
      <header className="report-header border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {report.logoUrl ? (
              <img src={report.logoUrl} alt={`${report.organizationName} logo`} className="h-12 w-12 rounded-lg object-cover" />
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">BizIntel AI</p>
              <h1 className="font-display text-2xl font-bold">{report.title}</h1>
              <p className="text-sm text-muted-foreground">{report.organizationName}</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground sm:text-right">
            <p>{report.periodLabel}</p>
            <p>Generated {formatReportDateTime(report.generatedAt)}</p>
          </div>
        </div>
      </header>

      <section className="report-block space-y-3">
        <SectionHeading>Executive Summary</SectionHeading>
        <div className="space-y-2 text-sm leading-relaxed">
          {report.summary.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </section>

      {report.ai.included ? (
        <section className="report-block space-y-3">
          <SectionHeading>AI Business Analysis</SectionHeading>
          {report.ai.unavailableReason ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              {report.ai.unavailableReason}
            </p>
          ) : (
            <>
              {report.ai.summary ? <p className="text-sm leading-relaxed">{report.ai.summary}</p> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                {report.ai.sections.map((s) => (
                  <div key={s.heading} className="rounded-lg border border-border p-4">
                    <p className="font-medium">{s.heading}</p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {s.points.map((p) => (
                        <li key={p}>• {p}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}

      {report.sections.map((section) => (
        <section key={section.id} className="report-block space-y-3">
          <SectionHeading>{section.title}</SectionHeading>
          <SectionBody section={section} currency={currency} />
        </section>
      ))}

      <section className="report-block space-y-3">
        <SectionHeading>Key Findings</SectionHeading>
        <FindingList items={report.findings} icon={CheckCircle2} />
      </section>

      <section className="report-block space-y-3">
        <SectionHeading>Business Risks</SectionHeading>
        <FindingList items={report.risks} icon={AlertTriangle} />
      </section>

      <section className="report-block space-y-3">
        <SectionHeading>Opportunities</SectionHeading>
        <FindingList items={report.opportunities} icon={Lightbulb} />
      </section>

      <section className="report-block space-y-3">
        <SectionHeading>Recommended Actions</SectionHeading>
        <ol className="space-y-4">
          {report.recommendations.map((rec, i) => (
            <li key={rec.title} className="rounded-lg border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Priority {i + 1}</p>
              <p className="mt-1 font-medium">{rec.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{rec.evidence}</p>
              {rec.nextStep ? <p className="mt-2 text-sm">{rec.nextStep}</p> : null}
            </li>
          ))}
          {report.recommendations.length === 0 ? (
            <li className="text-sm text-muted-foreground">No prioritised actions could be derived for this period.</li>
          ) : null}
        </ol>
      </section>

      <section className="report-block space-y-3">
        <SectionHeading>Data Quality</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Rows processed</dt>
              <dd className="tabular-nums">{formatNumber(report.dataQuality.rowsProcessed)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Missing dates</dt>
              <dd className="tabular-nums">{formatNumber(report.dataQuality.missingDates)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Missing revenue values</dt>
              <dd className="tabular-nums">{formatNumber(report.dataQuality.missingRevenue)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Duplicate records</dt>
              <dd className="tabular-nums">{formatNumber(report.dataQuality.duplicates)}</dd>
            </div>
          </dl>
          <div className="text-sm">
            <p className="font-medium">Available analysis</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              {report.dataQuality.availableMetrics.map((m) => (
                <li key={m}>✓ {m}</li>
              ))}
              {report.dataQuality.unavailableMetrics.map((m) => (
                <li key={m}>✕ {m}</li>
              ))}
            </ul>
          </div>
        </div>
        {report.limitations.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {report.limitations.map((l) => (
              <li key={l}>• {l}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <footer className="report-footer border-t border-border pt-4 text-xs text-muted-foreground">
        Generated by BizIntel AI · {report.organizationName} · {report.periodLabel} ·{" "}
        {formatReportDateTime(report.generatedAt)}. Figures represent the selected period as calculated at
        generation time.
      </footer>
    </article>
  );
}
