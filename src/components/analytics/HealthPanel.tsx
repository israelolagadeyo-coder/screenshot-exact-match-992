import { CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { BusinessHealth, DataQualitySummary } from "@/lib/analytics/types";

export function HealthPanel({ health }: { health: BusinessHealth }) {
  return (
    <section className="panel p-6" aria-label="Business health">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">Business health</h3>
        <span className="text-sm text-muted-foreground">{health.status}</span>
      </div>

      {health.score != null ? (
        <>
          <p className="mt-3 font-display text-4xl font-bold">
            {health.score}
            <span className="text-lg text-muted-foreground">/100</span>
          </p>
          <Progress value={health.score} className="mt-3" />
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          This cannot be determined from the available data.
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {health.factors.map((f) => {
          const Icon =
            f.kind === "positive"
              ? CheckCircle2
              : f.kind === "warning"
                ? TriangleAlert
                : CircleDashed;
          return (
            <li key={f.label} className="flex gap-3 text-sm">
              <Icon
                className={
                  f.kind === "positive"
                    ? "mt-0.5 h-4 w-4 shrink-0 text-primary"
                    : f.kind === "warning"
                      ? "mt-0.5 h-4 w-4 shrink-0 text-destructive"
                      : "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                }
                aria-hidden="true"
              />
              <span>
                <span className="font-medium">{f.label}. </span>
                <span className="text-muted-foreground">{f.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-xs text-muted-foreground">
        The score is the average of the measurable signals listed above. Every input is shown, so
        the result can always be checked.
      </p>
    </section>
  );
}

export function DataQualityPanel({ quality }: { quality: DataQualitySummary }) {
  return (
    <section className="panel p-6" aria-label="Data quality">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">Data quality</h3>
        <span className="font-display text-2xl font-bold">
          {quality.score != null ? `${quality.score}%` : "—"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Rows processed" value={quality.rowsProcessed} />
        <Stat label="Rows with a date" value={quality.rowsWithDate} />
        <Stat label="Missing dates" value={quality.missingDates} />
        <Stat label="Missing revenue" value={quality.missingRevenue} />
        <Stat label="Duplicate rows removed" value={quality.duplicates} />
        <Stat label="Invalid values" value={quality.invalidValues} />
      </dl>

      <div className="mt-5 space-y-2 text-sm">
        <p className="text-muted-foreground">
          Available: {quality.availableMetrics.join(", ") || "None yet"}
        </p>
        {quality.unavailableMetrics.length > 0 ? (
          <p className="text-muted-foreground">
            Unavailable: {quality.unavailableMetrics.join(", ")}
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Calculated as rows without problems divided by rows processed. This is a completeness
        measure, not a statistical confidence score.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}
