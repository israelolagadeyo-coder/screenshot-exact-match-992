# Analytics engine (Phase 3)

## Architecture

- **Database layer** (`security invoker` SQL functions, so RLS decides visibility):
  - `analytics_rows(org)` — normalises `dataset_rows.data` (jsonb) through each dataset's saved
    `column_mapping` into: date, product, customer, category, quantity, revenue, expense.
  - `analytics_coverage(org)` — which metrics the uploaded data can support + date bounds.
  - `analytics_period(org, from, to)` — totals for one window (revenue, transactions, units,
    expenses, customers, new customers, products, active days).
  - `analytics_trend(org, from, to, grain)` — day/week/month/quarter/year buckets.
  - `analytics_top_products`, `analytics_top_customers`, `analytics_expense_categories`.
- **Client layer** (`src/lib/analytics/`): `types.ts`, `dates.ts`, `format.ts`, `calc.ts`,
  `queries.ts` (React Query + RPC), `useAnalytics.ts`.
- **UI** (`src/components/analytics/`): KPI cards, chart card wrapper, trend chart, rank table,
  health and data-quality panels.

## Formulas

- Revenue: explicit mapped `revenue`, otherwise `quantity × unit_price` (never both).
- Growth: `((current − previous) / |previous|) × 100`; `previous = 0` returns `null` and the
  trend becomes `new`, never `Infinity` or `NaN`.
- Average order value: revenue ÷ transactions. Average selling price: revenue ÷ units.
- Previous period: the immediately preceding window of identical length; unavailable for
  "All time".
- Business health: average of scored signals (revenue, transaction, customer and expense growth,
  customer concentration), each mapped −20%→0, 0%→50, +20%→100. Every input is displayed.
- Data quality: `100 − (missing dates + missing revenue + invalid values) / rows processed`.

## Data requirements

Metrics appear only when the mapped columns exist; otherwise the UI states plainly why the
analysis is unavailable. No metric is ever estimated or invented.

## Security

Every function is `security invoker` and reads `dataset_rows` / `datasets`, both protected by
organisation-membership RLS. An organisation id supplied by the browser cannot unlock another
organisation's rows. Query cache keys include the organisation id and the date range.

## Phase 4 consumption

`src/lib/analytics/types.ts` exports `AnalyticsFact` with `metric`, `value`, `unit`, `period`,
`previousPeriod`, `source` and a `known | inferred | unknown` confidence. The AI analyst must call
these analytics functions rather than query tables, and must report "This cannot be determined
from the available data" whenever a value is null.

## Limitations

- Currency conversion is not performed; all figures use the organisation's configured currency.
- Customer identity is the mapped customer column as-is (no de-duplication or fuzzy matching).
- Profit is never reported, since cost of goods is not part of the supported data model.
