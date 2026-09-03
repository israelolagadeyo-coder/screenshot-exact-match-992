import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PhaseNotice } from "@/components/dashboard/PageHeader";

export const Route = createFileRoute("/dashboard/analytics")({
  component: AnalyticsPage,
  head: () => ({
    meta: [
      { title: "Analytics — BizIntel AI" },
      { name: "description", content: "Revenue, sales, product, customer and expense analytics." },
      { property: "og:title", content: "Analytics — BizIntel AI" },
      { property: "og:description", content: "Aggregated analytics and period comparisons calculated from your data." },
    ],
  }),
});

function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Analytics"
        description="Calculated metrics and trends from your structured business data."
      />
      <PhaseNotice
        phase="Next: analytics engine"
        items={[
          "Revenue trend and growth",
          "Sales performance",
          "Product performance",
          "Customer performance",
          "Expense analysis",
          "Period comparisons",
        ]}
      />
    </div>
  );
}
