import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PhaseNotice } from "@/components/dashboard/PageHeader";

export const Route = createFileRoute("/dashboard/data")({
  component: DataPage,
  head: () => ({
    meta: [
      { title: "Data — BizIntel AI" },
      { name: "description", content: "Upload, preview and validate your business datasets." },
      { property: "og:title", content: "Data — BizIntel AI" },
      { property: "og:description", content: "CSV and Excel uploads with validation, cleaning and dataset health checks." },
    ],
  }),
});

function DataPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Data"
        description="Upload sales, customer and expense files, then preview and validate them."
      />
      <PhaseNotice
        phase="Next: data pipeline"
        items={[
          "CSV and XLSX upload to private storage",
          "Column detection and spreadsheet preview",
          "Validation: missing values, duplicates, invalid dates",
          "Dataset health score",
          "Cleaning and structured storage",
          "Dataset management",
        ]}
      />
    </div>
  );
}
