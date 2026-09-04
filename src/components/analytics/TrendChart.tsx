import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBucket } from "@/lib/analytics/dates";
import { formatCompactCurrency, formatNumber } from "@/lib/analytics/format";
import type { Grain, TrendPoint } from "@/lib/analytics/types";

type Props = {
  data: TrendPoint[];
  grain: Grain;
  dataKey: keyof Pick<TrendPoint, "revenue" | "transactions" | "units" | "expenses">;
  kind?: "area" | "bar" | "line";
  currency: string;
  valueKind?: "currency" | "number";
  label: string;
};

export function TrendChart({
  data,
  grain,
  dataKey,
  kind = "area",
  currency,
  valueKind = "currency",
  label,
}: Props) {
  const points = data.map((d) => ({ ...d, bucketLabel: formatBucket(d.bucket, grain) }));
  const fmt = (v: number) =>
    valueKind === "currency" ? formatCompactCurrency(v, currency) : formatNumber(v);

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
      <XAxis
        dataKey="bucketLabel"
        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
        tickLine={false}
        axisLine={false}
        minTickGap={16}
      />
      <YAxis
        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
        tickLine={false}
        axisLine={false}
        width={72}
        tickFormatter={(v: number) => fmt(v)}
      />
      <Tooltip
        formatter={(v) => [fmt(Number(v)), label]}
        contentStyle={{
          background: "var(--popover)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          color: "var(--popover-foreground)",
          fontSize: 12,
        }}
      />
    </>
  );

  return (
    <div className="h-[280px] w-full" role="img" aria-label={`${label} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            {axes}
            <Bar dataKey={dataKey} fill="var(--primary)" radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : kind === "line" ? (
          <LineChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            {axes}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        ) : (
          <AreaChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${String(dataKey)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {axes}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke="var(--primary)"
              strokeWidth={2}
              fill={`url(#fill-${String(dataKey)})`}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
