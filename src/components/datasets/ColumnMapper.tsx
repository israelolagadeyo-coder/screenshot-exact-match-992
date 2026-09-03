import { CheckCircle2, Link2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ColumnMapping, DatasetType, StandardField } from "@/lib/datasets/types";
import { DATASET_SCHEMAS, DATASET_TYPE_LABELS } from "@/lib/datasets/types";

type ColumnMapperProps = {
  columns: Array<{ name: string; type: string }>;
  datasetType: DatasetType;
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
};

export function ColumnMapper({
  columns,
  datasetType,
  mapping,
  onMappingChange,
}: ColumnMapperProps) {
  if (datasetType === "unknown") {
    return (
      <div className="panel p-8 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <h3 className="mt-3 text-sm font-semibold">
          Auto-detection couldn't identify the dataset type
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Column mapping is available for Sales, Customers, and Expenses datasets. Your data has
          been stored as-is without mapping.
        </p>
      </div>
    );
  }

  const fields = DATASET_SCHEMAS[datasetType];
  const mappedFields = new Set(Object.values(mapping));

  const handleMap = (sourceColumn: string, fieldKey: string) => {
    const newMapping = { ...mapping };
    for (const [col, field] of Object.entries(newMapping)) {
      if (field === fieldKey) delete newMapping[col];
    }
    if (fieldKey !== "__none") {
      newMapping[sourceColumn] = fieldKey;
    } else {
      delete newMapping[sourceColumn];
    }
    onMappingChange(newMapping);
  };

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Column Mapping</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Map your columns to {DATASET_TYPE_LABELS[datasetType]} standard fields
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Link2 className="h-3 w-3" />
          {mappedFields.size}/{fields.length} mapped
        </Badge>
      </div>

      <div className="mt-5 space-y-3">
        {columns.map((col) => {
          const mappedField = mapping[col.name];
          const isMapped = Boolean(mappedField);

          return (
            <div
              key={col.name}
              className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{col.name}</p>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {col.type}
                  </Badge>
                </div>
                {isMapped && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Maps to: {fields.find((f) => f.key === mappedField)?.label}
                  </p>
                )}
              </div>

              <Select value={mappedField ?? "__none"} onValueChange={(v) => handleMap(col.name, v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Not mapped" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Not mapped</SelectItem>
                  {fields.map((field: StandardField) => (
                    <SelectItem key={field.key} value={field.key}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg bg-accent/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Required fields</span> are marked with *. Datasets with
          unmapped required fields will show validation warnings.
        </p>
      </div>
    </div>
  );
}
