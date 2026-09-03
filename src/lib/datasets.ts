import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  CanonicalField,
  CleanedRow,
  ColumnMapping,
  DataHealth,
  DetectedColumn,
} from "@/lib/data-parsing";

type Json = Database["public"]["Tables"]["datasets"]["Row"]["health"];
const asJson = (value: unknown): Json => value as Json;

export type DatasetKind = Database["public"]["Enums"]["dataset_kind"];
export type DatasetStatus = Database["public"]["Enums"]["dataset_status"];
export type DatasetRow = Database["public"]["Tables"]["datasets"]["Row"];

// ---------------------------------------------------------------------------
// Canonical schemas for the supported dataset kinds
// ---------------------------------------------------------------------------

export const DATASET_SCHEMAS: Record<DatasetKind, CanonicalField[]> = {
  sales: [
    { key: "date", label: "Date", type: "date", required: true },
    { key: "product", label: "Product", type: "text", required: true },
    { key: "customer", label: "Customer", type: "text", required: false },
    { key: "quantity", label: "Quantity", type: "number", required: true },
    { key: "unit_price", label: "Unit price", type: "number", required: true },
    { key: "revenue", label: "Revenue", type: "number", required: false },
  ],
  customers: [
    { key: "customer_id", label: "Customer ID", type: "text", required: true },
    { key: "customer_name", label: "Customer name", type: "text", required: true },
    { key: "date", label: "Date", type: "date", required: false },
    { key: "location", label: "Location", type: "text", required: false },
    { key: "purchase", label: "Purchase", type: "number", required: false },
  ],
  expenses: [
    { key: "date", label: "Date", type: "date", required: true },
    { key: "category", label: "Category", type: "text", required: true },
    { key: "description", label: "Description", type: "text", required: false },
    { key: "amount", label: "Amount", type: "number", required: true },
  ],
};

export const DATASET_KIND_LABELS: Record<DatasetKind, string> = {
  sales: "Sales",
  customers: "Customers",
  expenses: "Expenses",
};

export const DATASET_KIND_DESCRIPTIONS: Record<DatasetKind, string> = {
  sales: "Transactions with product, quantity, price and revenue.",
  customers: "Customer directory with identifiers, location and spend.",
  expenses: "Business costs by category, description and amount.",
};

export function schemaFor(kind: DatasetKind): CanonicalField[] {
  return DATASET_SCHEMAS[kind];
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function datasetsQuery(orgId: string | undefined) {
  return queryOptions({
    queryKey: ["datasets", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function datasetRowsQuery(datasetId: string | undefined, limit = 100) {
  return queryOptions({
    queryKey: ["dataset_rows", datasetId, limit],
    enabled: Boolean(datasetId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dataset_rows")
        .select("row_index, data")
        .eq("dataset_id", datasetId!)
        .order("row_index", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// Persistence: the full ingestion workflow
// ---------------------------------------------------------------------------

function extension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "csv" : filename.slice(idx + 1).toLowerCase();
}

export interface SaveDatasetArgs {
  organizationId: string;
  userId: string;
  name: string;
  kind: DatasetKind;
  file: File;
  sourceColumns: DetectedColumn[];
  mapping: ColumnMapping;
  cleanedRows: CleanedRow[];
  health: DataHealth;
}

/**
 * Persist a processed dataset:
 *  1. create the dataset record (status = processing)
 *  2. upload the original file to the private `datasets` bucket
 *  3. insert cleaned/structured rows in batches
 *  4. mark the dataset processed (or failed, with an error message)
 *
 * All writes are scoped to organization_id and enforced by RLS.
 */
export async function saveDataset(args: SaveDatasetArgs): Promise<string> {
  const {
    organizationId,
    userId,
    name,
    kind,
    file,
    sourceColumns,
    mapping,
    cleanedRows,
    health,
  } = args;

  const { data: created, error: insertError } = await supabase
    .from("datasets")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      name,
      kind,
      status: "processing",
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      row_count: cleanedRows.length,
      column_count: sourceColumns.length,
      source_columns: asJson(sourceColumns),
      column_mapping: asJson(mapping),
      health: asJson(health),
    })
    .select("id")
    .single();

  if (insertError || !created) {
    throw insertError ?? new Error("Could not create the dataset record.");
  }

  const datasetId = created.id;

  try {
    // 2. Upload the original file to private storage.
    const path = `${organizationId}/${datasetId}/original.${extension(file.name)}`;
    const uploadOptions = file.type
      ? { upsert: true, contentType: file.type }
      : { upsert: true };
    const { error: uploadError } = await supabase.storage
      .from("datasets")
      .upload(path, file, uploadOptions);
    if (uploadError) throw uploadError;

    await supabase.from("datasets").update({ file_path: path }).eq("id", datasetId);

    // 3. Insert structured rows in batches.
    const BATCH = 500;
    for (let i = 0; i < cleanedRows.length; i += BATCH) {
      const chunk = cleanedRows.slice(i, i + BATCH).map((data, j) => ({
        dataset_id: datasetId,
        organization_id: organizationId,
        row_index: i + j,
        data: asJson(data),
      }));
      const { error: rowsError } = await supabase.from("dataset_rows").insert(chunk);
      if (rowsError) throw rowsError;
    }

    // 4. Mark processed.
    const { error: doneError } = await supabase
      .from("datasets")
      .update({ status: "processed" })
      .eq("id", datasetId);
    if (doneError) throw doneError;

    return datasetId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed.";
    await supabase
      .from("datasets")
      .update({ status: "failed", error_message: message })
      .eq("id", datasetId);
    throw err;
  }
}

export async function deleteDataset(datasetId: string, filePath: string | null): Promise<void> {
  if (filePath) {
    await supabase.storage.from("datasets").remove([filePath]);
  }
  const { error } = await supabase.from("datasets").delete().eq("id", datasetId);
  if (error) throw error;
}
