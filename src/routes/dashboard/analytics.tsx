import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RangeSelect } from "@/components/analytics/RangeSelect";
import { ChartCard } from "@/components/analytics/ChartCard";
import { TrendChart } from "@/components/analytics/TrendChart";
import { RankTable } from "@/components/analytics/RankTable";
import { KpiCard, KpiCardSkeleton } from "@/components/analytics/KpiCard";
import { useAnalytics } from "@/lib/analytics/useAnalytics";
import {
  expenseCategoriesQuery,
  topCustomersQuery,
  topProductsQuery,
  trendQuery,
} from "@/lib/analytics/queries";
import { describeRange } from "@/lib/analytics/dates";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/analytics/format";
import { makeKpi, safeDivide } from "@/lib/analytics/calc";
import type { CustomerRow, ExpenseCategoryRow, ProductRow } from "@/lib/analytics/types";

export const Route = createFileRoute("/dashboard/analytics")({
  component: AnalyticsPage,
  head: () => ({
    meta: [
      { title: "Analytics — BizIntel AI" },
      { name: "description", content: "Revenue, sales, product, customer and expense analytics." },
      { property: "og:title", content: "Analytics — BizIntel AI" },
      {
        property: "og:description",
        content: "Aggregated analytics and period comparisons calculated from your own data.",
      },
    ],
  }),
});

function AnalyticsPage() {
  const a = useAnalytics("all");
  const currency = a.organization.currency;

  const trend = useQuery(trendQuery(a.orgId, a.range, a.grain));
  const products = useQuery(topProductsQuery(a.orgId, a.range, 10));
  const worstProducts = useQuery(topProductsQuery(a.orgId, a.range, 5, true));
  const customers = useQuery(topCustomersQuery(a.orgId, a.range, 10));
  const expenses = useQuery(expenseCategoriesQuery(a.orgId, a.range, 12));

  const cov = a.coverage;
  const cur = a.current;
  const points = trend.data ?? [];
  const notEnough = points.length < 2;

  const salesKpis =
    cur && cov
      ? [
          makeKpi({
            metric: "revenue_per_day",
            label: "Average revenue per day",
            value: safeDivide(cur.revenue, cur.days),
            previousValue: a.previous ? safeDivide(a.previous.revenue, a.previous.days) : null,
            format: "currency",
            hint: "Revenue divided by the number of days with activity.",
            available: cov.hasSales,
            unavailableReason: "No sales dataset has been uploaded.",
          }),
          makeKpi({
            metric: "revenue_per_transaction",
            label: "Revenue per transaction",
            value: safeDivide(cur.revenue, cur.transactions),
            previousValue: a.previous
              ? safeDivide(a.previous.revenue, a.previous.transactions)
              : null,
            format: "currency",
            hint: "Revenue divided by number of sales rows.",
            available: cov.hasSales,
            unavailableReason: "No sales dataset has been uploaded.",
          }),
          makeKpi({
            metric: "average_selling_price",
            label: "Average selling price",
            value: safeDivide(cur.revenue, cur.units),
            previousValue: a.previous ? safeDivide(a.previous.revenue, a.previous.units) : null,
            format: "currency",
            hint: "Revenue divided by units sold.",
            available: cov.hasSales && cur.units > 0,
            unavailableReason: "This dataset does not contain quantity information.",
          }),
        ]
      : [];

  const totalExpenses = (expenses.data ?? []).reduce((s, r) => s + r.amount, 0);
  const totalCustomerRevenue = (customers.data ?? []).reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Analytics"
        description="Every figure below is calculated from your uploaded datasets."
        action={<RangeSelect value={a.rangeKey} onChange={a.setRangeKey} />}
      />
      <p className="mt-2 text-sm text-muted-foreground">{describeRange(a.range)}</p>

      {a.errorMessage ? (
        <p className="panel mt-6 p-6 text-sm text-destructive">{a.errorMessage}</p>
      ) : null}

      {a.isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : (cov?.totalRows ?? 0) === 0 ? (
        <p className="panel mt-8 p-10 text-center text-sm text-muted-foreground">
          No processed data yet. Upload a dataset on the Data page to see analytics here.
        </p>
      ) : (
        <Tabs defaultValue="revenue" className="mt-8">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {salesKpis.map((k) => (
                <KpiCard key={k.metric} kpi={k} currency={currency} />
              ))}
            </div>
            <ChartCard
              title="Revenue trend"
              question="How has revenue changed?"
              loading={trend.isLoading}
              empty={notEnough || !cov?.hasSales}
              emptyMessage="Not enough dated sales rows in this period to draw a trend."
            >
              <TrendChart
                data={points}
                grain={a.grain}
                dataKey="revenue"
                currency={currency}
                label="Revenue"
              />
            </ChartCard>
          </TabsContent>

          <TabsContent value="sales" className="mt-6 space-y-6">
            <ChartCard
              title="Transaction volume"
              question="How many sales are happening?"
              loading={trend.isLoading}
              empty={notEnough || !cov?.hasSales}
            >
              <TrendChart
                data={points}
                grain={a.grain}
                dataKey="transactions"
                kind="bar"
                currency={currency}
                valueKind="number"
                label="Transactions"
              />
            </ChartCard>
            <ChartCard
              title="Units sold"
              question="How much volume is moving?"
              loading={trend.isLoading}
              empty={notEnough || (cur?.units ?? 0) === 0}
              emptyMessage="This dataset does not contain quantity information for the selected period."
            >
              <TrendChart
                data={points}
                grain={a.grain}
                dataKey="units"
                kind="line"
                currency={currency}
                valueKind="number"
                label="Units"
              />
            </ChartCard>
          </TabsContent>

          <TabsContent value="products" className="mt-6 space-y-6">
            <ChartCard
              title="Top products by revenue"
              question="What products generate the most revenue?"
              loading={products.isLoading}
              empty={!cov?.hasProducts || (products.data ?? []).length === 0}
              emptyMessage="Product analysis unavailable because this dataset does not contain identifiable product information."
            >
              <RankTable<ProductRow>
                caption="Top products by revenue"
                rows={products.data ?? []}
                columns={[
                  { key: "name", label: "Product", render: (r) => r.name },
                  {
                    key: "revenue",
                    label: "Revenue",
                    align: "right",
                    render: (r) => formatCurrency(r.revenue, currency),
                  },
                  {
                    key: "units",
                    label: "Units",
                    align: "right",
                    render: (r) => formatNumber(r.units),
                  },
                  {
                    key: "transactions",
                    label: "Transactions",
                    align: "right",
                    render: (r) => formatNumber(r.transactions),
                  },
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Lowest performing products"
              question="What is not selling?"
              loading={worstProducts.isLoading}
              empty={!cov?.hasProducts || (worstProducts.data ?? []).length === 0}
              emptyMessage="Product analysis unavailable because this dataset does not contain identifiable product information."
            >
              <RankTable<ProductRow>
                caption="Lowest performing products"
                rows={worstProducts.data ?? []}
                columns={[
                  { key: "name", label: "Product", render: (r) => r.name },
                  {
                    key: "revenue",
                    label: "Revenue",
                    align: "right",
                    render: (r) => formatCurrency(r.revenue, currency),
                  },
                  {
                    key: "units",
                    label: "Units",
                    align: "right",
                    render: (r) => formatNumber(r.units),
                  },
                ]}
              />
            </ChartCard>
          </TabsContent>

          <TabsContent value="customers" className="mt-6 space-y-6">
            <ChartCard
              title="Top customers"
              question="Which customers contribute the most?"
              loading={customers.isLoading}
              empty={!cov?.hasCustomers || (customers.data ?? []).length === 0}
              emptyMessage="Customer analysis unavailable because this dataset does not contain identifiable customer information."
            >
              <RankTable<CustomerRow>
                caption="Top customers by revenue"
                rows={customers.data ?? []}
                columns={[
                  { key: "name", label: "Customer", render: (r) => r.name },
                  {
                    key: "revenue",
                    label: "Revenue",
                    align: "right",
                    render: (r) => formatCurrency(r.revenue, currency),
                  },
                  {
                    key: "transactions",
                    label: "Transactions",
                    align: "right",
                    render: (r) => formatNumber(r.transactions),
                  },
                ]}
              />
              {totalCustomerRevenue > 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  New customers in this period: {formatNumber(cur?.newCustomers ?? null)} ·
                  Returning:{" "}
                  {formatNumber(
                    Math.max(0, (cur?.customers ?? 0) - (cur?.newCustomers ?? 0)),
                  )}{" "}
                  · Average revenue per customer:{" "}
                  {formatCurrency(safeDivide(cur?.revenue ?? null, cur?.customers ?? null), currency)}
                </p>
              ) : null}
            </ChartCard>
          </TabsContent>

          <TabsContent value="expenses" className="mt-6 space-y-6">
            <ChartCard
              title="Expense categories"
              question="Where is money going?"
              loading={expenses.isLoading}
              empty={!cov?.hasExpenses || (expenses.data ?? []).length === 0}
              emptyMessage="Expense analysis unavailable because no expense dataset has been uploaded."
            >
              <RankTable<ExpenseCategoryRow>
                caption="Expenses by category"
                rows={expenses.data ?? []}
                columns={[
                  { key: "name", label: "Category", render: (r) => r.name },
                  {
                    key: "amount",
                    label: "Amount",
                    align: "right",
                    render: (r) => formatCurrency(r.amount, currency),
                  },
                  {
                    key: "entries",
                    label: "% of total",
                    align: "right",
                    render: (r) =>
                      totalExpenses > 0
                        ? `${((r.amount / totalExpenses) * 100).toFixed(1)}%`
                        : "—",
                  },
                ]}
              />
              {cov?.hasExpenses && cov.hasSales && (cur?.revenue ?? 0) > 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Expenses represent{" "}
                  {formatPercent(((cur?.expenses ?? 0) / (cur?.revenue ?? 1)) * 100, 1).replace(
                    "+",
                    "",
                  )}{" "}
                  of revenue in this period.
                </p>
              ) : null}
            </ChartCard>

            <ChartCard
              title="Expense trend"
              question="How are expenses changing?"
              loading={trend.isLoading}
              empty={!cov?.hasExpenses || notEnough}
              emptyMessage="Expense analysis unavailable because no dated expense data exists for this period."
            >
              <TrendChart
                data={points}
                grain={a.grain}
                dataKey="expenses"
                kind="bar"
                currency={currency}
                label="Expenses"
              />
            </ChartCard>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
