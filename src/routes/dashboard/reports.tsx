import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PhaseNotice } from "@/components/dashboard/PageHeader";

export const Route = createFileRoute("/dashboard/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reports — BizIntel AI" },
      { name: "description", content: "Generate structured business performance reports." },
      { property: "og:title", content: "Reports — BizIntel AI" },
      { property: "og:description", content: "Executive summaries, performance sections, insights and recommendations." },
    ],
  }),
});

function ReportsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reports"
        description="Board-ready business performance reports generated from your data."
      />
      <PhaseNotice
        phase="Later: reporting"
        items={[
          "Business performance report",
          "Executive summary",
          "Revenue, sales, customer and product sections",
          "Key insights and recommendations",
          "Report states: generating, completed, failed",
          "Report preview and export",
        ]}
      />
    </div>
  );
}
