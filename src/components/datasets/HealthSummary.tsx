import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import type { ValidationSummary } from "@/lib/datasets/types";

type HealthSummaryProps = {
  validation: ValidationSummary;
  rowCount: number;
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";
  const bgColor =
    score >= 80 ? "bg-success/10" : score >= 50 ? "bg-warning/10" : "bg-destructive/10";

  return (
    <div className={`flex h-20 w-20 items-center justify-center rounded-full ${bgColor}`}>
      <div className="text-center">
        <span className={`text-2xl font-bold ${color}`}>{score}</span>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Health</p>
      </div>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  count,
  tone,
}: {
  icon: typeof Info;
  label: string;
  count: number;
  tone: "success" | "warning" | "destructive" | "info";
}) {
  const toneClasses = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    info: "text-muted-foreground bg-muted",
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${toneClasses[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{count.toLocaleString()}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function HealthSummary({ validation, rowCount }: HealthSummaryProps) {
  const hasIssues =
    validation.missingRequired > 0 ||
    validation.invalidDates > 0 ||
    validation.invalidNumbers > 0 ||
    validation.duplicates > 0;

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Data Health</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {rowCount.toLocaleString()} records analyzed
          </p>
        </div>
        <ScoreRing score={validation.healthScore} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatItem
          icon={XCircle}
          label="Missing required fields"
          count={validation.missingRequired}
          tone={validation.missingRequired > 0 ? "destructive" : "success"}
        />
        <StatItem
          icon={AlertTriangle}
          label="Duplicate records"
          count={validation.duplicates}
          tone={validation.duplicates > 0 ? "warning" : "success"}
        />
        <StatItem
          icon={XCircle}
          label="Invalid dates"
          count={validation.invalidDates}
          tone={validation.invalidDates > 0 ? "destructive" : "success"}
        />
        <StatItem
          icon={XCircle}
          label="Invalid numbers"
          count={validation.invalidNumbers}
          tone={validation.invalidNumbers > 0 ? "destructive" : "success"}
        />
        <StatItem
          icon={Info}
          label="Missing values"
          count={validation.missingValues}
          tone={validation.missingValues > 0 ? "info" : "success"}
        />
        <StatItem
          icon={CheckCircle2}
          label="Unique values (OK)"
          count={Math.max(0, rowCount - validation.duplicates)}
          tone="success"
        />
      </div>

      {hasIssues && validation.issues.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium">Issue Details</h4>
          <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3">
            {validation.issues.slice(0, 50).map((issue, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 font-medium text-muted-foreground">
                  Row {issue.rowIndex + 1}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="flex-1 text-foreground">{issue.message}</span>
              </div>
            ))}
            {validation.issues.length > 50 && (
              <p className="pt-1 text-xs text-muted-foreground">
                ...and {validation.issues.length - 50} more issues
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
