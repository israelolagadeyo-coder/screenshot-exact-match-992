import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartCard({
  title,
  question,
  action,
  loading,
  error,
  empty,
  emptyMessage,
  children,
}: {
  title: string;
  question?: string;
  action?: ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel p-6" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          {question ? <p className="mt-1 text-sm text-muted-foreground">{question}</p> : null}
        </div>
        {action}
      </div>

      <div className="mt-6">
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">{error}</p>
        ) : empty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {emptyMessage ?? "Not enough data to display this yet."}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
