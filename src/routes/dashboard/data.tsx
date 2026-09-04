import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth";
import { useDatasets, type DatasetListItem } from "@/lib/datasets/queries";
import { uploadAndProcessDataset, deleteDataset, type UploadProgress } from "@/lib/datasets/api";
import { UploadZone } from "@/components/datasets/UploadZone";
import { validateFile } from "@/components/datasets/validateFile";
import { DatasetList } from "@/components/datasets/DatasetList";
import { DatasetDetailDialog } from "@/components/datasets/DatasetDetailDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

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
  const { organization } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: datasets, isLoading } = useDatasets(organization.id);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DatasetListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleFileSelected = async (file: File) => {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!user?.id) {
      setError("You must be signed in to upload data.");
      return;
    }

    setUploading(true);
    setProgress({ stage: "Starting...", percent: 0 });

    try {
      const result = await uploadAndProcessDataset(file, organization.id, user.id, setProgress);
      toast.success(`"${result.name}" uploaded and processed successfully`);
      await queryClient.invalidateQueries({ queryKey: ["datasets", organization.id] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handleView = (ds: DatasetListItem) => {
    setDetailId(ds.id);
    setDetailOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDataset(deleteTarget.id, organization.id);
      toast.success(`"${deleteTarget.name}" has been deleted`);
      await queryClient.invalidateQueries({ queryKey: ["datasets", organization.id] });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete dataset");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Data"
        description="Upload sales, customer and expense files, then preview and validate them."
      />

      <div className="mt-6">
        <UploadZone
          onFileSelected={handleFileSelected}
          uploading={uploading}
          progress={progress}
          error={error}
          onDismissError={() => setError(null)}
        />
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DatasetList datasets={datasets ?? []} onView={handleView} onDelete={setDeleteTarget} />
        )}
      </div>

      <DatasetDetailDialog datasetId={detailId} open={detailOpen} onOpenChange={setDetailOpen} />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dataset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}" and all its stored rows. The
              original file will also be removed from private storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
