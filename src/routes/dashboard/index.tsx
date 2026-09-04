import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { KpiCard, KpiCardSkeleton } from "@/components/analytics/KpiCard";
import { RangeSelect } from "@/components/analytics/RangeSelect";
import { ChartCard } from "@/components/analytics/ChartCard";
import { TrendChart } from "@/components/analytics/TrendChart";
import { DataQualityPanel, HealthPanel } from "@/components/analytics/HealthPanel";
import { useAnalytics } from "@/lib/analytics/useAnalytics";
import { trendQuery } from "@/lib/analytics/queries";
import { buildDataQuality } from "@/lib/analytics/calc";
import { describeRange } from "@/lib/analytics/dates";
import { useDatasets } from "@/lib/datasets/queries";

export const Route = createFileRoute("/dashboard/")({
  component: OverviewPage,
  head: () => ({
    meta: [
      { title: "Overview — BizIntel AI" },
      { name: "description", content: "Your business KPIs, calculated from your uploaded data." },
      { property: "og:title", content: "Overview — BizIntel AI" },
      {
        property: "og:description",
        content: "Revenue, growth, transactions, customers and expenses at a glance.",
      },
    ],
  }),
});

function OverviewPage() {
  const a = useAnalytics("all");
  const currency = a.organization.currency;
  const trend = useQuery(trendQuery(a.orgId, a.range, a.grain));
  const datasets = useDatasets(a.orgId);

  const issues = (datasets.data ?? []).reduce(
    (acc, d) => ({
      duplicates: acc.duplicates + (d.validation?.duplicates ?? 0),
      invalidValues:
        acc.invalidValues + (d.validation?.invalidDates ?? 0) + (d.validation?.invalidNumbers ?? 0),
    }),
    { duplicates: 0, invalidValues: 0 },
  );

  const hasAnyData = (a.coverage?.totalRows ?? 0) > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={a.organization.name}
        description={`${a.organization.industry ?? "Business"} · ${a.organization.country} · ${currency}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <RangeSelect value={a.rangeKey} onChange={a.setRangeKey} />
            <Button asChild>
              <Link to="/dashboard/data">Upload Data</Link>
            </Button>
          </div>
        }
      />

      <p className="mt-2 text-sm text-muted-foreground">{describeRange(a.range)}</p>

      {a.errorMessage ? (
        <p className="panel mt-6 p-6 text-sm text-destructive">{a.errorMessage}</p>
      ) : null}

      {a.isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : !hasAnyData ? (
        <div className="panel mt-8 p-10 text-center">
          <h2 className="font-display text-xl font-semibold">
            Your business intelligence starts here.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Upload your first dataset to generate your dashboard. BizIntel AI never displays
            estimated or invented figures.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard/data">Upload Data</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(a.kpis ?? []).map((kpi) => (
              <KpiCard key={kpi.metric} kpi={kpi} currency={currency} />
            ))}
          </div>

          <div className="mt-6">
            <ChartCard
              title="Revenue trend"
              question="How has revenue changed over time?"
              loading={trend.isLoading}
              empty={(trend.data ?? []).length < 2}
              emptyMessage="Not enough dated sales rows in this period to draw a trend."
            >
              <TrendChart
                data={trend.data ?? []}
                grain={a.grain}
                dataKey="revenue"
                currency={currency}
                label="Revenue"
              />
            </ChartCard>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {a.health ? <HealthPanel health={a.health} /> : null}
            {a.coverage ? (
              <DataQualityPanel quality={buildDataQuality(a.coverage, issues)} />
            ) : null}
          </div>

          <div className="mt-6 text-center">
            <Button asChild variant="outline">
              <Link to="/dashboard/analytics">Open full analytics</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
