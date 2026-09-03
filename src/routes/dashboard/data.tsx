import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { DatasetList } from "@/components/data/DatasetList";
import { UploadWizard } from "@/components/data/UploadWizard";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org-context";

export const Route = createFileRoute("/dashboard/data")({
  component: DataPage,
  head: () => ({
    meta: [
      { title: "Data — BizIntel AI" },
      { name: "description", content: "Upload, preview and validate your business datasets." },
      { property: "og:title", content: "Data — BizIntel AI" },
      {
        property: "og:description",
        content: "CSV and Excel uploads with validation, cleaning and dataset health checks.",
      },
    ],
  }),
});

function DataPage() {
  const { organization, role } = useOrg();
  const { user } = useAuth();
  const canManage = role === "owner" || role === "admin" || role === "analyst";
  const [uploading, setUploading] = useState(false);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={uploading ? "Upload data" : "Data"}
        description={
          uploading
            ? "Preview, validate and map your file before saving it to your workspace."
            : "Upload sales, customer and expense files, then preview and validate them."
        }
        action={
          !uploading && canManage ? (
            <Button onClick={() => setUploading(true)}>
              <Plus className="size-4" /> Upload data
            </Button>
          ) : undefined
        }
      />

      <div className="mt-8">
        {uploading && user ? (
          <UploadWizard
            organizationId={organization.id}
            userId={user.id}
            onDone={() => setUploading(false)}
            onCancel={() => setUploading(false)}
          />
        ) : (
          <DatasetList
            organizationId={organization.id}
            canManage={canManage}
            onUpload={() => setUploading(true)}
          />
        )}
      </div>
    </div>
  );
}
