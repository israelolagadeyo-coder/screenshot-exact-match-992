import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ColumnInfo = {
  name: string;
  type: string;
  sample: string | number | boolean | null;
  missing: number;
  unique: number;
};

type DataPreviewProps = {
  columns: ColumnInfo[];
  rows: Record<string, string | number | boolean | null>[];
  maxRows?: number;
};

const TYPE_COLORS: Record<string, string> = {
  date: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  number: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  text: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  boolean: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

export function DataPreview({ columns, rows, maxRows = 50 }: DataPreviewProps) {
  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-muted-foreground">No data to preview yet.</p>
      </div>
    );
  }

  const displayRows = rows.slice(0, maxRows);

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Data Preview</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Showing {displayRows.length} of {rows.length} rows · {columns.length} columns
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10 text-center">#</TableHead>
              {columns.map((col) => (
                <TableHead key={col.name} className="min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{col.name}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                        TYPE_COLORS[col.type] ?? TYPE_COLORS["text"],
                      )}
                    >
                      {col.type}
                    </span>
                    {col.missing > 0 && (
                      <span className="text-[10px] text-destructive">{col.missing} missing</span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell className="w-10 text-center text-xs text-muted-foreground">
                  {idx + 1}
                </TableCell>
                {columns.map((col) => {
                  const val = row[col.name];
                  const isNull = val === null || val === "";
                  return (
                    <TableCell
                      key={col.name}
                      className={cn(
                        "max-w-[200px] truncate text-xs",
                        isNull && "text-muted-foreground/50 italic",
                      )}
                    >
                      {isNull ? "—" : String(val)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {rows.length > maxRows && (
        <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
          {rows.length - maxRows} more rows not shown
        </div>
      )}
    </div>
  );
}

export function ColumnStats({ columns }: { columns: ColumnInfo[] }) {
  return (
    <div className="panel p-6">
      <h3 className="text-sm font-semibold">Column Summary</h3>
      <div className="mt-4 space-y-3">
        {columns.map((col) => (
          <div
            key={col.name}
            className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{col.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sample: {col.sample !== null ? String(col.sample) : "—"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge variant="outline" className={TYPE_COLORS[col.type] ?? TYPE_COLORS["text"]}>
                {col.type}
              </Badge>
              <div className="text-right text-xs">
                <p className="font-medium">{col.unique.toLocaleString()} unique</p>
                <p className={col.missing > 0 ? "text-destructive" : "text-muted-foreground"}>
                  {col.missing} missing
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
