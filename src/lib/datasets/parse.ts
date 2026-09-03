import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ColumnType, DetectedColumn, ParsedFile } from "./types";

const MAX_ROWS_FOR_ANALYSIS = 5000;
const MAX_PREVIEW_ROWS = 50;

function detectFileType(fileName: string): "csv" | "xlsx" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
  return null;
}

function inferColumnType(values: (string | number | boolean | null)[]): ColumnType {
  const nonNull = values.filter((v) => v !== null && v !== "" && v !== undefined);
  if (nonNull.length === 0) return "text";

  let numberCount = 0;
  let dateCount = 0;
  let booleanCount = 0;

  for (const val of nonNull.slice(0, 200)) {
    const str = String(val).trim();
    if (str === "") continue;

    if (str === "true" || str === "false" || str === "yes" || str === "no") {
      booleanCount++;
      continue;
    }

    const numStr = str.replace(/[,$€₦£\s]/g, "");
    if (numStr !== "" && !isNaN(Number(numStr)) && isFinite(Number(numStr))) {
      numberCount++;
      continue;
    }

    if (isValidDateString(str)) {
      dateCount++;
      continue;
    }
  }

  const total = Math.min(nonNull.length, 200);
  if (total === 0) return "text";

  if (booleanCount / total > 0.8) return "boolean";
  if (numberCount / total > 0.7) return "number";
  if (dateCount / total > 0.7) return "date";
  return "text";
}

function isValidDateString(str: string): boolean {
  if (!str || str.length < 6) return false;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) return true;
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(str)) return true;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return true;
  const d = new Date(str);
  return !isNaN(d.getTime()) && str.length >= 8 && /\d{4}/.test(str);
}

function buildColumns(rows: Record<string, string | number | boolean | null>[]): DetectedColumn[] {
  if (rows.length === 0) return [];

  const columnNames = Object.keys(rows[0]!);
  return columnNames.map((name) => {
    const values = rows.map((r) => r[name] ?? null);
    const nonNullValues = values.filter((v) => v !== null && v !== "");
    const uniqueSet = new Set(nonNullValues.map((v) => String(v)));
    const missing = values.length - nonNullValues.length;
    const sample = nonNullValues[0] ?? null;
    const type = inferColumnType(values);

    return {
      name,
      type,
      sample,
      missing,
      unique: uniqueSet.size,
      values,
    };
  });
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const fileType = detectFileType(file.name);
  if (!fileType) {
    throw new Error(`Unsupported file type: ${file.name}. Please upload a CSV or XLSX file.`);
  }

  if (fileType === "csv") {
    return parseCsv(file);
  }
  return parseXlsx(file);
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string | number | null>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          reject(new Error(`CSV parsing error: ${results.errors[0]?.message}`));
          return;
        }

        const rawRows = results.data as Record<string, string>[];
        const rows = rawRows.map((r) => {
          const cleaned: Record<string, string | number | boolean | null> = {};
          for (const [k, v] of Object.entries(r)) {
            cleaned[k] = v === "" || v === undefined ? null : v;
          }
          return cleaned;
        });

        const analysisRows = rows.slice(0, MAX_ROWS_FOR_ANALYSIS);
        const columns = buildColumns(analysisRows);

        resolve({
          columns,
          rows: analysisRows,
          rowCount: rows.length,
          columnCount: columns.length,
        });
      },
      error: (err) => reject(new Error(`CSV parsing failed: ${err.message}`)),
    });
  });
}

async function parseXlsx(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The Excel file does not contain any sheets.");
  }

  const sheet = workbook.Sheets[sheetName]!;
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  const rows = rawRows.map((r) => {
    const cleaned: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(r)) {
      if (v === null || v === undefined || v === "") {
        cleaned[k] = null;
      } else if (v instanceof Date) {
        cleaned[k] = v.toISOString().split("T")[0]!;
      } else {
        cleaned[k] = typeof v === "number" || typeof v === "boolean" ? v : String(v);
      }
    }
    return cleaned;
  });

  const analysisRows = rows.slice(0, MAX_ROWS_FOR_ANALYSIS);
  const columns = buildColumns(analysisRows);

  return {
    columns,
    rows: analysisRows,
    rowCount: rows.length,
    columnCount: columns.length,
  };
}

export function buildPreview(
  rows: Record<string, string | number | boolean | null>[],
  maxRows = MAX_PREVIEW_ROWS,
): Record<string, string | number | boolean | null>[] {
  return rows.slice(0, maxRows);
}

export function getFileType(fileName: string): "csv" | "xlsx" | null {
  return detectFileType(fileName);
}

export const PREVIEW_ROW_LIMIT = MAX_PREVIEW_ROWS;
