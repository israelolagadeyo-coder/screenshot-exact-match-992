import {
  CheckCircle2,
  AlertTriangle,
  CalendarX,
  Hash,
  Copy,
  CircleSlash,
} from "lucide-react";
import type { DataHealth } from "@/lib/data-parsing";
import { cn } from "@/lib/utils";

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "neutral" | "warning" | "danger" | "success";
}

function Stat({ icon, label, value, tone }: StatProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          tone === "danger" && "bg-destructive/10 text-destructive",
          tone === "warning" && "bg-warning/15 text-warning",
          tone === "success" && "bg-success/15 text-success",
          tone === "neutral" && "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold tabular-nums leading-none">{value.toLocaleString()}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function DataHealthSummary({ health }: { health: DataHealth }) {
  const score = pct(health.validRows, health.totalRows);
  const scoreTone = score >= 90 ? "success" : score >= 70 ? "warning" : "danger";

  return (
    <section aria-label="Data health summary" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">Data health</h3>
          <p className="text-sm text-muted-foreground">
            {health.validRows.toLocaleString()} of {health.totalRows.toLocaleString()} rows are
            clean.
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
            scoreTone === "success" && "bg-success/15 text-success",
            scoreTone === "warning" && "bg-warning/15 text-warning",
            scoreTone === "danger" && "bg-destructive/10 text-destructive",
          )}
        >
          {scoreTone === "success" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <AlertTriangle className="size-4" />
          )}
          {score}% healthy
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          icon={<CheckCircle2 className="size-4" />}
          label="Valid rows"
          value={health.validRows}
          tone="success"
        />
        <Stat
          icon={<CircleSlash className="size-4" />}
          label="Missing values"
          value={health.missingValues}
          tone={health.missingValues > 0 ? "warning" : "neutral"}
        />
        <Stat
          icon={<Copy className="size-4" />}
          label="Duplicate rows"
          value={health.duplicateRows}
          tone={health.duplicateRows > 0 ? "warning" : "neutral"}
        />
        <Stat
          icon={<CalendarX className="size-4" />}
          label="Invalid dates"
          value={health.invalidDates}
          tone={health.invalidDates > 0 ? "danger" : "neutral"}
        />
        <Stat
          icon={<Hash className="size-4" />}
          label="Invalid numbers"
          value={health.invalidNumbers}
          tone={health.invalidNumbers > 0 ? "danger" : "neutral"}
        />
        <Stat
          icon={<AlertTriangle className="size-4" />}
          label="Missing required"
          value={health.missingRequired}
          tone={health.missingRequired > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Field</th>
              <th className="px-3 py-2 text-left font-medium">Mapped column</th>
              <th className="px-3 py-2 text-right font-medium">Missing</th>
              <th className="px-3 py-2 text-right font-medium">Invalid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {health.fields.map((f) => (
              <tr key={f.key}>
                <td className="px-3 py-2 font-medium">{f.label}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {f.mappedTo ?? <span className="italic text-destructive">unmapped</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{f.missing.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.invalid.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
