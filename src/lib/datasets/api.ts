import { supabase } from "@/integrations/supabase/client";
import { buildPreview, getFileType, parseFile } from "./parse";
import { cleanData, validateData } from "./validate";
import { detectDatasetType, suggestMapping } from "./mapping";
import type { ColumnMapping, DatasetType } from "./types";

export type UploadProgress = {
  stage: string;
  percent: number;
};

export type ProcessedDataset = {
  id: string;
  name: string;
  datasetType: DatasetType;
  status: string;
  rowCount: number;
  columnCount: number;
};

const STORAGE_BUCKET = "datasets";

function onProgress(stage: string, percent: number, cb?: (p: UploadProgress) => void) {
  cb?.({ stage, percent });
}

export async function uploadAndProcessDataset(
  file: File,
  organizationId: string,
  userId: string,
  progressCb?: (p: UploadProgress) => void,
): Promise<ProcessedDataset> {
  const fileType = getFileType(file.name);
  if (!fileType) {
    throw new Error(`Unsupported file type. Please upload a CSV or XLSX file.`);
  }

  onProgress("Creating dataset record", 5, progressCb);

  const { data: datasetRecord, error: insertError } = await supabase
    .from("datasets")
    .insert({
      organization_id: organizationId,
      uploaded_by: userId,
      name: file.name,
      file_path: "",
      file_size: file.size,
      file_type: fileType,
      status: "uploading",
    })
    .select()
    .single();

  if (insertError || !datasetRecord) {
    throw new Error(`Failed to create dataset: ${insertError?.message ?? "Unknown error"}`);
  }

  const datasetId = datasetRecord.id;
  const filePath = `${organizationId}/${datasetId}/${file.name}`;

  onProgress("Uploading file to private storage", 15, progressCb);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    await supabase
      .from("datasets")
      .update({ status: "error", error_message: uploadError.message })
      .eq("id", datasetId);
    throw new Error(`File upload failed: ${uploadError.message}`);
  }

  onProgress("Updating file path", 25, progressCb);

  const { error: pathError } = await supabase
    .from("datasets")
    .update({ file_path: filePath, status: "uploaded" })
    .eq("id", datasetId);

  if (pathError) {
    throw new Error(`Failed to update file path: ${pathError.message}`);
  }

  onProgress("Parsing file", 35, progressCb);

  let parsed;
  try {
    parsed = await parseFile(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Parse failed";
    await supabase
      .from("datasets")
      .update({ status: "error", error_message: msg })
      .eq("id", datasetId);
    throw new Error(msg);
  }

  onProgress("Detecting columns and types", 50, progressCb);

  const datasetType = detectDatasetType(parsed.columns);
  const autoMapping = suggestMapping(parsed.columns, datasetType);

  onProgress("Validating data", 60, progressCb);
  const validation = validateData(parsed, datasetType, autoMapping);

  onProgress("Cleaning data", 75, progressCb);
  const { cleanedRows, summary: cleaningSummary } = cleanData(parsed, validation);

  onProgress("Storing structured data", 85, progressCb);

  const mappedRows = cleanedRows.map((row, idx) => ({
    dataset_id: datasetId,
    organization_id: organizationId,
    row_index: idx,
    data: row,
  }));

  if (mappedRows.length > 0) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
      const batch = mappedRows.slice(i, i + BATCH_SIZE);
      const { error: rowsError } = await supabase.from("dataset_rows").insert(batch);
      if (rowsError) {
        throw new Error(`Failed to store rows: ${rowsError.message}`);
      }
    }
  }

  onProgress("Finalizing", 95, progressCb);

  const preview = buildPreview(cleanedRows);

  const { error: finalizeError } = await supabase
    .from("datasets")
    .update({
      status: "processed",
      dataset_type: datasetType,
      row_count: cleanedRows.length,
      column_count: parsed.columns.length,
      columns: JSON.parse(
        JSON.stringify(
          parsed.columns.map((c) => ({
            name: c.name,
            type: c.type,
            sample: c.sample,
            missing: c.missing,
            unique: c.unique,
          })),
        ),
      ),
      column_mapping: autoMapping as Record<string, string>,
      validation: JSON.parse(JSON.stringify(validation)),
      cleaning: JSON.parse(JSON.stringify(cleaningSummary)),
      preview: JSON.parse(JSON.stringify(preview)),
    })
    .eq("id", datasetId);

  if (finalizeError) {
    throw new Error(`Failed to finalize dataset: ${finalizeError.message}`);
  }

  onProgress("Complete", 100, progressCb);

  return {
    id: datasetId,
    name: file.name,
    datasetType,
    status: "processed",
    rowCount: cleanedRows.length,
    columnCount: parsed.columns.length,
  };
}

export async function deleteDataset(datasetId: string, organizationId: string): Promise<void> {
  const { data: dataset } = await supabase
    .from("datasets")
    .select("file_path")
    .eq("id", datasetId)
    .maybeSingle();

  if (dataset?.file_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([dataset.file_path]);
  }

  const { error } = await supabase.from("datasets").delete().eq("id", datasetId);
  if (error) throw new Error(`Failed to delete dataset: ${error.message}`);
}

export async function updateColumnMapping(
  datasetId: string,
  mapping: ColumnMapping,
): Promise<void> {
  const { error } = await supabase
    .from("datasets")
    .update({ column_mapping: mapping as Record<string, string>, status: "processed" })
    .eq("id", datasetId);
  if (error) throw new Error(`Failed to update mapping: ${error.message}`);
}
