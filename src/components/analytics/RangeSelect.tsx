import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RANGE_PRESETS, buildRange } from "@/lib/analytics/dates";
import type { DateRangePresetKey } from "@/lib/analytics/types";

export function RangeSelect({
  value,
  onChange,
}: {
  value: DateRangePresetKey;
  onChange: (key: DateRangePresetKey) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DateRangePresetKey)}>
      <SelectTrigger className="w-[190px]" aria-label="Date range">
        <SelectValue placeholder="Date range" />
      </SelectTrigger>
      <SelectContent>
        {RANGE_PRESETS.map((key) => (
          <SelectItem key={key} value={key}>
            {buildRange(key).label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
