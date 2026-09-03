import { ArrowRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CanonicalField, ColumnMapping, DetectedColumn } from "@/lib/data-parsing";

const NONE = "__none__";

interface ColumnMapperProps {
  fields: CanonicalField[];
  columns: DetectedColumn[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

export function ColumnMapper({ fields, columns, mapping, onChange }: ColumnMapperProps) {
  const setField = (key: string, value: string) => {
    onChange({ ...mapping, [key]: value === NONE ? null : value });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Match each expected field to a column from your file. Required fields are marked with an
        asterisk.
      </p>
      <div className="grid gap-3">
        {fields.map((field) => {
          const value = mapping[field.key] ?? NONE;
          const unmappedRequired = field.required && value === NONE;
          return (
            <div
              key={field.key}
              className="grid grid-cols-[1fr_auto_1.4fr] items-center gap-3 rounded-lg border border-border bg-background/50 p-3"
            >
              <div className="min-w-0">
                <Label className="flex items-center gap-1 text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </Label>
                <span className="text-xs capitalize text-muted-foreground">{field.type}</span>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <Select value={value} onValueChange={(v) => setField(field.key, v)}>
                <SelectTrigger
                  className={unmappedRequired ? "border-destructive text-destructive" : ""}
                  aria-label={`Column for ${field.label}`}
                >
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    <span className="text-muted-foreground">Not mapped</span>
                  </SelectItem>
                  {columns.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.name}
                      <span className="ml-2 text-xs text-muted-foreground">({col.type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
