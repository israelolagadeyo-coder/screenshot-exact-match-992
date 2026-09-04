import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMetric, formatPercent } from "@/lib/analytics/format";
import type { KPI } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

export function KpiCardSkeleton() {
  return (
    <div className="panel p-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-3 h-3 w-40" />
    </div>
  );
}

export function KpiCard({ kpi, currency }: { kpi: KPI; currency: string }) {
  const TrendIcon =
    kpi.trend === "up" ? ArrowUpRight : kpi.trend === "down" ? ArrowDownRight : ArrowRight;

  const trendClass =
    kpi.trend === "up"
      ? "text-primary"
      : kpi.trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="panel p-6">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{kpi.label}</p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              aria-label={`How ${kpi.label} is calculated`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px]">
              <p>{kpi.available ? kpi.hint : (kpi.unavailableReason ?? kpi.hint)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <p className="mt-2 font-display text-3xl font-bold">
        {kpi.available ? (
          formatMetric(kpi.value, kpi.format, currency)
        ) : (
          <span className="text-lg font-medium text-muted-foreground">Not available</span>
        )}
      </p>

      {kpi.available ? (
        kpi.changePercent != null ? (
          <p className={cn("mt-2 flex items-center gap-1 text-xs font-medium", trendClass)}>
            <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {formatPercent(kpi.changePercent)} vs previous period
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {kpi.trend === "new"
              ? "New activity — no previous period to compare"
              : "No comparable previous period"}
          </p>
        )
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{kpi.unavailableReason}</p>
      )}
    </div>
  );
}
