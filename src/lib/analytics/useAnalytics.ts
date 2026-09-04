import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrg } from "@/lib/org-context";
import { buildRange, previousRange, suggestGrain } from "./dates";
import { coverageQuery, periodQuery, topCustomersQuery } from "./queries";
import { buildBusinessHealth, buildOverviewKpis } from "./calc";
import type { DateRangePresetKey } from "./types";

export function useAnalyticsRange(initial: DateRangePresetKey = "all") {
  const [rangeKey, setRangeKey] = useState<DateRangePresetKey>(initial);
  const range = useMemo(() => buildRange(rangeKey), [rangeKey]);
  const grain = useMemo(() => suggestGrain(range), [range]);
  const previous = useMemo(() => previousRange(range), [range]);
  return { rangeKey, setRangeKey, range, previous, grain };
}

export function useAnalytics(initial: DateRangePresetKey = "all") {
  const { organization } = useOrg();
  const state = useAnalyticsRange(initial);
  const orgId = organization.id;

  const coverage = useQuery(coverageQuery(orgId));
  const current = useQuery(periodQuery(orgId, state.range));
  const prior = useQuery(periodQuery(orgId, state.previous));
  const topCustomers = useQuery(topCustomersQuery(orgId, state.range, 5));

  const kpis = useMemo(() => {
    if (!coverage.data || !current.data) return null;
    return buildOverviewKpis(current.data, prior.data ?? null, coverage.data);
  }, [coverage.data, current.data, prior.data]);

  const health = useMemo(() => {
    if (!coverage.data || !current.data) return null;
    const totalRevenue = current.data.revenue;
    const top = topCustomers.data?.[0];
    const share =
      top && totalRevenue > 0 ? Math.min(100, (top.revenue / totalRevenue) * 100) : null;
    return buildBusinessHealth(current.data, prior.data ?? null, coverage.data, share);
  }, [coverage.data, current.data, prior.data, topCustomers.data]);

  const error = coverage.error ?? current.error ?? null;

  return {
    ...state,
    organization,
    orgId,
    coverage: coverage.data ?? null,
    current: current.data ?? null,
    previous: prior.data ?? null,
    kpis,
    health,
    isLoading: coverage.isLoading || current.isLoading,
    errorMessage: error
      ? "We couldn't load your analytics right now. Please try again in a moment."
      : null,
  };
}
