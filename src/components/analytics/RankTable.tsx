import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type RankColumn<T> = {
  key: keyof T & string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => string;
  sortable?: boolean;
};

export function RankTable<T extends { name: string }>({
  rows,
  columns,
  caption,
}: {
  rows: T[];
  columns: RankColumn<T>[];
  caption: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey as keyof T];
      const bv = b[sortKey as keyof T];
      if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
      return asc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [rows, sortKey, asc]);

  const toggle = (key: string) => {
    if (sortKey === key) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={col.align === "right" ? "text-right" : undefined}
              >
                {col.sortable === false ? (
                  col.label
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(col.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    aria-label={`Sort by ${col.label}`}
                  >
                    {col.label}
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => (
            <TableRow key={`${row.name}-${i}`}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={col.align === "right" ? "text-right tabular-nums" : "font-medium"}
                >
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
