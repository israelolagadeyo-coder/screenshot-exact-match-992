import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Database,
  MoreVertical,
  Trash2,
  Eye,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  datasetsQuery,
  deleteDataset,
  DATASET_KIND_LABELS,
  type DatasetRow,
  type DatasetStatus,
} from "@/lib/datasets";
import type { DataHealth } from "@/lib/data-parsing";
import { DatasetDetail } from "./DatasetDetail";

const STATUS_META: Record<
  DatasetStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  uploaded: {
    label: "Uploaded",
    className: "bg-muted text-muted-foreground",
    icon: <FileSpreadsheet className="size-3" />,
  },
  processing: {
    label: "Processing",
    className: "bg-warning/15 text-warning",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  processed: {
    label: "Processed",
    className: "bg-success/15 text-success",
    icon: <CheckCircle2 className="size-3" />,
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive",
    icon: <AlertTriangle className="size-3" />,
  },
};

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

interface DatasetListProps {
  organizationId: string;
  canManage: boolean;
  onUpload: () => void;
}

export function DatasetList({ organizationId, canManage, onUpload }: DatasetListProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(datasetsQuery(organizationId));
  const [toDelete, setToDelete] = useState<DatasetRow | null>(null);
  const [viewing, setViewing] = useState<DatasetRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteDataset(toDelete.id, toDelete.file_path);
      await queryClient.invalidateQueries({ queryKey: ["datasets", organizationId] });
      toast.success("Dataset deleted.");
      setToDelete(null);
    } catch {
      toast.error("We couldn't delete that dataset.");
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="panel flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Database className="size-7" />
        </span>
        <div className="space-y-1">
          <h3 className="font-display text-lg font-semibold">No datasets yet</h3>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Upload a CSV or XLSX file of your sales, customers or expenses to get started.
          </p>
        </div>
        {canManage && <Button onClick={onUpload}>Upload data</Button>}
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {data.map((dataset) => {
          const status = STATUS_META[dataset.status];
          const health = dataset.health as unknown as DataHealth | null;
          return (
            <li key={dataset.id} className="panel flex items-center gap-4 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <FileSpreadsheet className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{dataset.name}</p>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {DATASET_KIND_LABELS[dataset.kind]}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {dataset.row_count.toLocaleString()} rows · {dataset.column_count} columns ·{" "}
                  {formatBytes(dataset.file_size)}
                  {health && typeof health.validRows === "number" && (
                    <> · {health.validRows.toLocaleString()} clean</>
                  )}
                </p>
              </div>
              <span
                className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${status.className}`}
              >
                {status.icon}
                {status.label}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Dataset actions">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setViewing(dataset)}>
                    <Eye className="size-4" /> View data
                  </DropdownMenuItem>
                  {canManage && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setToDelete(dataset)}
                    >
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>

      <DatasetDetail
        dataset={viewing}
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
      />

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this dataset?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${toDelete?.name}" and its stored file and rows will be permanently removed. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
