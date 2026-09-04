import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";
import type { AnalyticsDateRange, DateRangePresetKey, Grain } from "./types";

export const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function buildRange(key: DateRangePresetKey, today = new Date()): AnalyticsDateRange {
  const make = (label: string, from: Date | null, to: Date | null): AnalyticsDateRange => ({
    key,
    label,
    from: from ? iso(from) : null,
    to: to ? iso(to) : null,
  });

  switch (key) {
    case "today":
      return make("Today", today, today);
    case "yesterday": {
      const y = addDays(today, -1);
      return make("Yesterday", y, y);
    }
    case "last7":
      return make("Last 7 days", addDays(today, -6), today);
    case "last30":
      return make("Last 30 days", addDays(today, -29), today);
    case "last90":
      return make("Last 90 days", addDays(today, -89), today);
    case "this_month":
      return make("This month", startOfMonth(today), endOfMonth(today));
    case "prev_month": {
      const p = subMonths(today, 1);
      return make("Previous month", startOfMonth(p), endOfMonth(p));
    }
    case "this_quarter":
      return make("This quarter", startOfQuarter(today), endOfQuarter(today));
    case "prev_quarter": {
      const p = subQuarters(today, 1);
      return make("Previous quarter", startOfQuarter(p), endOfQuarter(p));
    }
    case "this_year":
      return make("This year", startOfYear(today), endOfYear(today));
    case "prev_year": {
      const p = subYears(today, 1);
      return make("Previous year", startOfYear(p), endOfYear(p));
    }
    case "all":
    default:
      return make("All time", null, null);
  }
}

export const RANGE_PRESETS: DateRangePresetKey[] = [
  "all",
  "last7",
  "last30",
  "last90",
  "this_month",
  "prev_month",
  "this_quarter",
  "prev_quarter",
  "this_year",
  "prev_year",
  "today",
  "yesterday",
];

/**
 * The immediately preceding window of the same length.
 * Returns null when the current range is unbounded (no comparison is possible).
 */
export function previousRange(range: AnalyticsDateRange): AnalyticsDateRange | null {
  if (!range.from || !range.to) return null;
  const from = new Date(`${range.from}T00:00:00`);
  const to = new Date(`${range.to}T00:00:00`);
  const days = differenceInCalendarDays(to, from) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return {
    key: "custom",
    label: "Previous period",
    from: iso(prevFrom),
    to: iso(prevTo),
  };
}

/** Chart bucket size that keeps a range readable. */
export function suggestGrain(range: AnalyticsDateRange): Grain {
  if (!range.from || !range.to) return "month";
  const days = differenceInCalendarDays(new Date(range.to), new Date(range.from)) + 1;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  if (days <= 730) return "month";
  return "quarter";
}

export function describeRange(range: AnalyticsDateRange): string {
  if (!range.from || !range.to) return "All available data";
  return `${format(new Date(`${range.from}T00:00:00`), "d MMM yyyy")} – ${format(
    new Date(`${range.to}T00:00:00`),
    "d MMM yyyy",
  )}`;
}

export function formatBucket(bucket: string, grain: Grain): string {
  const d = new Date(`${bucket}T00:00:00`);
  if (grain === "day") return format(d, "d MMM");
  if (grain === "week") return format(d, "d MMM");
  if (grain === "month") return format(d, "MMM yyyy");
  if (grain === "quarter") return `Q${Math.floor(d.getMonth() / 3) + 1} ${format(d, "yyyy")}`;
  return format(d, "yyyy");
}
