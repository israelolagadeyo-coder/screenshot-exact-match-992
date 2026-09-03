import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataHealthSummary } from "./DataHealthSummary";
import { DataPreviewTable, type PreviewColumn } from "./DataPreviewTable";
import {
  datasetRowsQuery,
  schemaFor,
  DATASET_KIND_LABELS,
  type DatasetRow,
} from "@/lib/datasets";
import type { DataHealth } from "@/lib/data-parsing";

interface DatasetDetailProps {
  dataset: DatasetRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DatasetDetail({ dataset, open, onOpenChange }: DatasetDetailProps) {
  const { data: rows, isLoading } = useQuery(datasetRowsQuery(dataset?.id));

  if (!dataset) return null;

  const fields = schemaFor(dataset.kind);
  const columns: PreviewColumn[] = fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
  }));
  const health = dataset.health as unknown as DataHealth | null;
  const previewRows =
    rows?.map((r) => r.data as unknown as Record<string, string | number | null>) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dataset.name}
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium capitalize text-accent-foreground">
              {DATASET_KIND_LABELS[dataset.kind]}
            </span>
          </DialogTitle>
          <DialogDescription>
            {dataset.row_count.toLocaleString()} rows from {dataset.original_filename}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {health && typeof health.totalRows === "number" && (
            <DataHealthSummary health={health} />
          )}

          <div className="space-y-2">
            <h3 className="font-display text-sm font-semibold">Structured data</h3>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading rows…
              </div>
            ) : previewRows.length > 0 ? (
              <DataPreviewTable columns={columns} rows={previewRows} maxRows={100} />
            ) : (
              <p className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
                No structured rows stored for this dataset.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
