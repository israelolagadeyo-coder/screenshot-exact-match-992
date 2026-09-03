import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function PhaseNotice({ phase, items }: { phase: string; items: string[] }) {
  return (
    <div className="panel mt-6 p-8">
      <span className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
        {phase}
      </span>
      <h2 className="mt-4 text-lg font-semibold">Your business intelligence starts here.</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        This area unlocks once your data pipeline is in place. It will include:
      </p>
      <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        {items.map((i) => (
          <li key={i} className="rounded-lg border border-border px-3 py-2">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
