import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { datasetDetailQuery } from "@/lib/datasets/queries";
import { updateColumnMapping } from "@/lib/datasets/api";
import { DATASET_TYPE_LABELS, type ColumnMapping } from "@/lib/datasets/types";
import { HealthSummary } from "./HealthSummary";
import { DataPreview, ColumnStats } from "./DataPreview";
import { ColumnMapper } from "./ColumnMapper";
import { toast } from "sonner";

type DatasetDetailDialogProps = {
  datasetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DatasetDetailDialog({ datasetId, open, onOpenChange }: DatasetDetailDialogProps) {
  const queryClient = useQueryClient();
  const { data: dataset, isLoading } = useQuery(
    datasetDetailQuery(open ? (datasetId ?? undefined) : undefined),
  );
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dataset?.column_mapping) {
      setMapping(dataset.column_mapping as ColumnMapping);
    }
  }, [dataset?.column_mapping]);

  const handleSaveMapping = async () => {
    if (!datasetId) return;
    setSaving(true);
    try {
      await updateColumnMapping(datasetId, mapping);
      await queryClient.invalidateQueries({ queryKey: ["dataset-detail", datasetId] });
      toast.success("Column mapping saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save mapping");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg">
            <span className="truncate">{dataset?.name ?? "Dataset"}</span>
            {dataset && (
              <Badge variant="secondary" className="shrink-0">
                {DATASET_TYPE_LABELS[dataset.dataset_type as keyof typeof DATASET_TYPE_LABELS] ??
                  dataset.dataset_type}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : dataset ? (
          <div className="space-y-4">
            {dataset.status === "error" ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm text-destructive">
                  {dataset.error_message ?? "This dataset encountered an error during processing."}
                </p>
              </div>
            ) : (
              <Tabs defaultValue="preview">
                <TabsList>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="health">Health</TabsTrigger>
                  <TabsTrigger value="columns">Columns</TabsTrigger>
                  <TabsTrigger value="mapping">Mapping</TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="mt-4">
                  <DataPreview
                    columns={
                      (dataset.columns as Array<{
                        name: string;
                        type: string;
                        sample: string | number | boolean | null;
                        missing: number;
                        unique: number;
                      }>) ?? []
                    }
                    rows={
                      (dataset.preview as Record<string, string | number | boolean | null>[]) ?? []
                    }
                  />
                </TabsContent>

                <TabsContent value="health" className="mt-4">
                  <HealthSummary
                    validation={(() => {
                      const v = dataset.validation as {
                        healthScore?: number;
                        missingValues?: number;
                        duplicates?: number;
                        invalidDates?: number;
                        invalidNumbers?: number;
                        missingRequired?: number;
                        issues?: Array<{
                          type: string;
                          column: string;
                          rowIndex: number;
                          message: string;
                          value: string | null;
                        }>;
                      };
                      return {
                        healthScore: v.healthScore ?? 0,
                        missingValues: v.missingValues ?? 0,
                        duplicates: v.duplicates ?? 0,
                        invalidDates: v.invalidDates ?? 0,
                        invalidNumbers: v.invalidNumbers ?? 0,
                        missingRequired: v.missingRequired ?? 0,
                        issues: (v.issues ?? []).map((i) => ({
                          type: i.type as
                            | "missing"
                            | "duplicate"
                            | "invalid_date"
                            | "invalid_number"
                            | "missing_required",
                          column: i.column,
                          rowIndex: i.rowIndex,
                          message: i.message,
                          value: i.value,
                        })),
                      };
                    })()}
                    rowCount={dataset.row_count}
                  />
                </TabsContent>

                <TabsContent value="columns" className="mt-4">
                  <ColumnStats
                    columns={
                      (dataset.columns as Array<{
                        name: string;
                        type: string;
                        sample: string | number | boolean | null;
                        missing: number;
                        unique: number;
                      }>) ?? []
                    }
                  />
                </TabsContent>

                <TabsContent value="mapping" className="mt-4">
                  <div className="space-y-3">
                    <ColumnMapper
                      columns={(dataset.columns as Array<{ name: string; type: string }>) ?? []}
                      datasetType={
                        dataset.dataset_type as "sales" | "customers" | "expenses" | "unknown"
                      }
                      mapping={mapping}
                      onMappingChange={setMapping}
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleSaveMapping} disabled={saving}>
                        {saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Mapping
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {dataset.cleaning &&
              (dataset.cleaning as { totalFixes?: number }).totalFixes !== undefined && (
                <div className="rounded-lg bg-accent/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Cleaning applied:</span>{" "}
                    {
                      (
                        dataset.cleaning as {
                          removedDuplicates: number;
                          trimmedWhitespace: number;
                          normalizedDates: number;
                          removedEmptyRows: number;
                          totalFixes: number;
                        }
                      ).removedDuplicates
                    }{" "}
                    duplicates removed,{" "}
                    {(dataset.cleaning as { trimmedWhitespace: number }).trimmedWhitespace}{" "}
                    whitespace trimmed,{" "}
                    {(dataset.cleaning as { normalizedDates: number }).normalizedDates} dates
                    normalized,{" "}
                    {(dataset.cleaning as { removedEmptyRows: number }).removedEmptyRows} empty rows
                    removed
                  </p>
                </div>
              )}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Dataset not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
