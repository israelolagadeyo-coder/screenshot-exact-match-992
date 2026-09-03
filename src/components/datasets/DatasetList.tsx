import { Database, FileSpreadsheet, MoreHorizontal, Trash2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DATASET_TYPE_LABELS } from "@/lib/datasets/types";
import type { DatasetListItem } from "@/lib/datasets/queries";

type DatasetListProps = {
  datasets: DatasetListItem[];
  onView: (dataset: DatasetListItem) => void;
  onDelete: (dataset: DatasetListItem) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    processed: "bg-success/10 text-success border-success/20",
    error: "bg-destructive/10 text-destructive border-destructive/20",
    uploading: "bg-warning/10 text-warning border-warning/20",
  };
  const labels: Record<string, string> = {
    processed: "Processed",
    error: "Error",
    uploading: "Uploading",
    parsed: "Parsed",
    validated: "Validated",
    cleaned: "Cleaned",
  };

  return (
    <Badge variant="outline" className={styles[status] ?? "border-border text-muted-foreground"}>
      {labels[status] ?? status}
    </Badge>
  );
}

function HealthBadge({ score }: { score?: number | undefined }) {
  if (score === undefined) return <span className="text-muted-foreground">—</span>;
  const tone = score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";
  return <span className={`font-medium ${tone}`}>{score}%</span>;
}

export function DatasetList({ datasets, onView, onDelete }: DatasetListProps) {
  if (datasets.length === 0) {
    return (
      <div className="panel p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Database className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-sm font-semibold">No datasets yet</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload your first file above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Datasets</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{datasets.length} total</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Rows</TableHead>
            <TableHead className="text-right">Columns</TableHead>
            <TableHead className="text-center">Health</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {datasets.map((ds) => (
            <TableRow key={ds.id} className="cursor-pointer" onClick={() => onView(ds)}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{ds.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ds.file_type.toUpperCase()} · {formatBytes(ds.file_size)}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  {DATASET_TYPE_LABELS[ds.dataset_type as keyof typeof DATASET_TYPE_LABELS] ??
                    ds.dataset_type}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {ds.row_count.toLocaleString()}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">{ds.column_count}</TableCell>
              <TableCell className="text-center">
                <HealthBadge score={ds.validation?.healthScore} />
              </TableCell>
              <TableCell>
                <StatusBadge status={ds.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(ds.created_at)}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(ds)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(ds)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete dataset
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
