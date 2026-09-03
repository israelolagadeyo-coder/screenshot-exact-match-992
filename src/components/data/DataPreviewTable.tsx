import { cn } from "@/lib/utils";

export interface PreviewColumn {
  key: string;
  label: string;
  type: string;
}

type CellValue = string | number | null;

interface DataPreviewTableProps {
  columns: PreviewColumn[];
  rows: Record<string, CellValue>[];
  /** Row index -> field key -> issue kind. `__duplicate` flags a duplicate row. */
  issues?: Record<number, Record<string, "missing" | "invalid">>;
  maxRows?: number;
}

const TYPE_STYLES: Record<string, string> = {
  date: "bg-chart-3/15 text-chart-3",
  number: "bg-primary/15 text-primary",
  text: "bg-muted text-muted-foreground",
  boolean: "bg-chart-5/15 text-chart-5",
  empty: "bg-muted text-muted-foreground",
};

export function DataPreviewTable({
  columns,
  rows,
  issues = {},
  maxRows = 50,
}: DataPreviewTableProps) {
  const visible = rows.slice(0, maxRows);

  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
          <tr>
            <th className="w-12 border-b border-border px-3 py-2 text-right font-medium text-muted-foreground">
              #
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                className="border-b border-l border-border px-3 py-2 text-left align-top"
              >
                <div className="flex flex-col gap-1">
                  <span className="whitespace-nowrap font-medium text-foreground">{col.label}</span>
                  <span
                    className={cn(
                      "w-fit rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      TYPE_STYLES[col.type] ?? TYPE_STYLES.text,
                    )}
                  >
                    {col.type}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => {
            const rowIssues = issues[i] ?? {};
            const isDuplicate = "__duplicate" in rowIssues && rowIssues["__duplicate"] != null;
            return (
              <tr
                key={i}
                className={cn("even:bg-muted/20", isDuplicate && "bg-warning/10 even:bg-warning/10")}
              >
                <td className="border-b border-border px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                  {isDuplicate && (
                    <span className="ml-1 text-warning" title="Duplicate row">
                      •
                    </span>
                  )}
                </td>
                {columns.map((col) => {
                  const issue = rowIssues[col.key];
                  const value = row[col.key];
                  const isEmpty = value === null || value === undefined || value === "";
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        "max-w-[220px] truncate border-b border-l border-border px-3 py-1.5",
                        issue === "invalid" && "bg-destructive/10 text-destructive",
                        issue === "missing" && "bg-warning/10",
                      )}
                      title={isEmpty ? "" : String(value)}
                    >
                      {isEmpty ? (
                        <span className="italic text-muted-foreground/60">
                          {issue === "missing" ? "required" : "—"}
                        </span>
                      ) : (
                        String(value)
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="border-t border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
          Showing first {maxRows.toLocaleString()} of {rows.length.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}
