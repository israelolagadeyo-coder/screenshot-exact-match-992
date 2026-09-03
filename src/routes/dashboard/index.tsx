import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useOrg } from "@/lib/org-context";

export const Route = createFileRoute("/dashboard/")({
  component: OverviewPage,
  head: () => ({
    meta: [
      { title: "Overview — BizIntel AI" },
      { name: "description", content: "Your business KPIs, calculated from your uploaded data." },
      { property: "og:title", content: "Overview — BizIntel AI" },
      { property: "og:description", content: "Revenue, growth, orders, customers and average order value at a glance." },
    ],
  }),
});

const KPIS = [
  { label: "Revenue", hint: "Total revenue in the selected period" },
  { label: "Revenue Growth", hint: "Change vs the previous period" },
  { label: "Orders", hint: "Number of transactions" },
  { label: "Customers", hint: "Unique customers" },
  { label: "Average Order Value", hint: "Revenue ÷ orders" },
];

function OverviewPage() {
  const { organization } = useOrg();

  // Phase 1: no datasets exist yet, so every metric is honestly "Not available".
  const hasData = false;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={organization.name}
        description={`${organization.industry ?? "Business"} · ${organization.country} · ${organization.currency}`}
        action={
          <Button asChild>
            <Link to="/dashboard/data">Upload Data</Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KPIS.map((k) => (
          <div key={k.label} className="panel p-6">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="mt-2 font-display text-3xl font-bold">
              {hasData ? "—" : <span className="text-muted-foreground">Not available</span>}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="panel mt-8 p-10 text-center">
        <h2 className="text-xl font-semibold">Your business intelligence starts here.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Upload your first dataset to generate your dashboard and insights. Until then, BizIntel AI
          will not display estimated or invented figures.
        </p>
        <Button asChild className="mt-6">
          <Link to="/dashboard/data">Upload Data</Link>
        </Button>
      </div>
    </div>
  );
}
