import Papa from "papaparse";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DetectedType = "date" | "number" | "text" | "boolean" | "empty";

export interface DetectedColumn {
  name: string;
  type: DetectedType;
  /** Share of non-empty cells (0–1). */
  fillRate: number;
  /** Count of empty / missing cells. */
  missing: number;
  /** A few example values, for the preview. */
  samples: string[];
}

export interface ParsedFile {
  headers: string[];
  /** Raw string rows keyed by header. */
  rows: Record<string, string>[];
  columns: DetectedColumn[];
}

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------

const MAX_ROWS = 20_000;

function normaliseHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((raw, i) => {
    let name = (raw ?? "").toString().trim();
    if (!name) name = `column_${i + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name}_${count + 1}`;
  });
}

function rowsFromMatrix(matrix: unknown[][]): ParsedFile {
  const [headerRow, ...body] = matrix;
  const headers = normaliseHeaders((headerRow ?? []).map((h) => (h == null ? "" : String(h))));

  const rows: Record<string, string>[] = [];
  for (const raw of body.slice(0, MAX_ROWS)) {
    if (!raw || raw.every((cell) => cell == null || String(cell).trim() === "")) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      const cell = raw[i];
      row[h] = cell == null ? "" : String(cell).trim();
    });
    rows.push(row);
  }

  return { headers, rows, columns: detectColumns(headers, rows) };
}

export async function parseCsv(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });
  if (result.errors.length && result.data.length === 0) {
    throw new Error(result.errors[0]?.message ?? "Could not read the CSV file.");
  }
  return rowsFromMatrix(result.data as unknown[][]);
}

export async function parseXlsx(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("The spreadsheet has no sheets.");
  const sheet = workbook.Sheets[firstSheetName]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  return rowsFromMatrix(matrix);
}

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsv(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseXlsx(file);
  throw new Error("Unsupported file type. Upload a .csv or .xlsx file.");
}

// ---------------------------------------------------------------------------
// Type detection
// ---------------------------------------------------------------------------

const BOOLEAN_VALUES = new Set(["true", "false", "yes", "no", "y", "n"]);

export function isEmptyValue(value: string | null | undefined): boolean {
  if (value == null) return true;
  const v = value.trim().toLowerCase();
  return v === "" || v === "na" || v === "n/a" || v === "null" || v === "-" || v === "—";
}

export function parseNumber(value: string): number | null {
  if (isEmptyValue(value)) return null;
  // Strip currency symbols, thousands separators and spaces.
  const cleaned = value
    .replace(/[₦$€£¥]/g, "")
    .replace(/[,\s]/g, "")
    .replace(/[()]/g, (m) => (m === "(" ? "-" : "")); // accounting negatives
  if (cleaned === "" || cleaned === "-") return null;
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const DATE_PATTERNS: RegExp[] = [
  /^\d{4}-\d{1,2}-\d{1,2}$/, // 2024-01-31
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // 31/01/2024 or 01/31/24
  /^\d{1,2}-\d{1,2}-\d{2,4}$/, // 31-01-2024
  /^\d{1,2}\.\d{1,2}\.\d{2,4}$/, // 31.01.2024
  /^\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4}$/, // 31 Jan 2024
  /^[A-Za-z]{3,}\s+\d{1,2},?\s+\d{2,4}$/, // Jan 31, 2024
];

export function parseDate(value: string): string | null {
  if (isEmptyValue(value)) return null;
  const v = value.trim();

  // ISO first.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (iso) {
    const [, y, m, d] = iso;
    return toIso(Number(y), Number(m), Number(d));
  }

  // Day/Month/Year or Month/Day/Year separated by / - or .
  const parts = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(v);
  if (parts) {
    let a = Number(parts[1]);
    let b = Number(parts[2]);
    let y = Number(parts[3]);
    if (y < 100) y += y < 70 ? 2000 : 1900;
    // Prefer DD/MM/YYYY (project default region), fall back to MM/DD when day > 12.
    let day = a;
    let month = b;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      day = b;
      month = a;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return toIso(y, month, day);
  }

  // Textual months via native parser.
  const parsed = Date.parse(v);
  if (!Number.isNaN(parsed)) {
    const dt = new Date(parsed);
    return toIso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }
  return null;
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function looksLikeDate(value: string): boolean {
  if (isEmptyValue(value)) return false;
  return DATE_PATTERNS.some((re) => re.test(value.trim())) && parseDate(value) !== null;
}

function inferType(values: string[]): DetectedType {
  const nonEmpty = values.filter((v) => !isEmptyValue(v));
  if (nonEmpty.length === 0) return "empty";

  let numbers = 0;
  let dates = 0;
  let booleans = 0;
  for (const v of nonEmpty) {
    if (looksLikeDate(v)) dates += 1;
    else if (parseNumber(v) !== null) numbers += 1;
    if (BOOLEAN_VALUES.has(v.trim().toLowerCase())) booleans += 1;
  }

  const total = nonEmpty.length;
  const threshold = 0.8;
  if (dates / total >= threshold) return "date";
  if (numbers / total >= threshold) return "number";
  if (booleans / total >= threshold) return "boolean";
  return "text";
}

export function detectColumns(
  headers: string[],
  rows: Record<string, string>[],
): DetectedColumn[] {
  return headers.map((name) => {
    const values = rows.map((r) => r[name] ?? "");
    const missing = values.filter((v) => isEmptyValue(v)).length;
    const samples = values.filter((v) => !isEmptyValue(v)).slice(0, 3);
    return {
      name,
      type: inferType(values),
      fillRate: rows.length === 0 ? 0 : (rows.length - missing) / rows.length,
      missing,
      samples,
    };
  });
}

// ---------------------------------------------------------------------------
// Validation + cleaning against a canonical schema
// ---------------------------------------------------------------------------

export type CanonicalType = "date" | "number" | "text";

export interface CanonicalField {
  key: string;
  label: string;
  type: CanonicalType;
  required: boolean;
}

export interface FieldHealth {
  key: string;
  label: string;
  mappedTo: string | null;
  missing: number;
  invalid: number;
}

export interface DataHealth {
  totalRows: number;
  validRows: number;
  missingValues: number;
  duplicateRows: number;
  invalidDates: number;
  invalidNumbers: number;
  missingRequired: number;
  fields: FieldHealth[];
}

export type CleanedRow = Record<string, string | number | null>;

export interface CleaningResult {
  cleanedRows: CleanedRow[];
  health: DataHealth;
  /** Row-level issues keyed by original row index -> field keys with problems. */
  issues: Record<number, Record<string, "missing" | "invalid">>;
}

export type ColumnMapping = Record<string, string | null>;

/**
 * Validate + clean raw rows against the canonical schema using the supplied
 * column mapping (canonical field key -> source column name).
 */
export function cleanAndValidate(
  rows: Record<string, string>[],
  fields: CanonicalField[],
  mapping: ColumnMapping,
): CleaningResult {
  const cleanedRows: CleanedRow[] = [];
  const issues: Record<number, Record<string, "missing" | "invalid">> = {};

  const fieldHealth: Record<string, FieldHealth> = {};
  for (const f of fields) {
    fieldHealth[f.key] = {
      key: f.key,
      label: f.label,
      mappedTo: mapping[f.key] ?? null,
      missing: 0,
      invalid: 0,
    };
  }

  let invalidDates = 0;
  let invalidNumbers = 0;
  let missingValues = 0;
  let missingRequired = 0;
  const seen = new Map<string, number>();
  let duplicateRows = 0;

  rows.forEach((row, index) => {
    const cleaned: CleanedRow = {};
    const rowIssues: Record<string, "missing" | "invalid"> = {};

    for (const field of fields) {
      const source = mapping[field.key];
      const raw = source ? (row[source] ?? "") : "";

      if (isEmptyValue(raw)) {
        cleaned[field.key] = null;
        fieldHealth[field.key]!.missing += 1;
        missingValues += 1;
        if (field.required) {
          rowIssues[field.key] = "missing";
          missingRequired += 1;
        }
        continue;
      }

      if (field.type === "number") {
        const n = parseNumber(raw);
        if (n === null) {
          cleaned[field.key] = null;
          fieldHealth[field.key]!.invalid += 1;
          invalidNumbers += 1;
          rowIssues[field.key] = "invalid";
        } else {
          cleaned[field.key] = n;
        }
      } else if (field.type === "date") {
        const d = parseDate(raw);
        if (d === null) {
          cleaned[field.key] = null;
          fieldHealth[field.key]!.invalid += 1;
          invalidDates += 1;
          rowIssues[field.key] = "invalid";
        } else {
          cleaned[field.key] = d;
        }
      } else {
        cleaned[field.key] = raw.trim();
      }
    }

    // Duplicate detection over the mapped canonical values.
    const signature = JSON.stringify(cleaned);
    if (seen.has(signature)) {
      duplicateRows += 1;
      rowIssues["__duplicate"] = "invalid";
    } else {
      seen.set(signature, index);
    }

    if (Object.keys(rowIssues).length > 0) issues[index] = rowIssues;
    cleanedRows.push(cleaned);
  });

  const rowsWithIssues = Object.keys(issues).length;
  const health: DataHealth = {
    totalRows: rows.length,
    validRows: rows.length - rowsWithIssues,
    missingValues,
    duplicateRows,
    invalidDates,
    invalidNumbers,
    missingRequired,
    fields: fields.map((f) => fieldHealth[f.key]!),
  };

  return { cleanedRows, health, issues };
}

/**
 * Best-effort automatic mapping of canonical fields to detected columns by
 * fuzzy name match.
 */
export function autoMap(fields: CanonicalField[], columns: DetectedColumn[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const field of fields) {
    const target = norm(field.key);
    const label = norm(field.label);
    let match = columns.find((c) => !used.has(c.name) && norm(c.name) === target);
    if (!match) match = columns.find((c) => !used.has(c.name) && norm(c.name) === label);
    if (!match) {
      match = columns.find(
        (c) => !used.has(c.name) && (norm(c.name).includes(target) || target.includes(norm(c.name))),
      );
    }
    if (match) {
      mapping[field.key] = match.name;
      used.add(match.name);
    } else {
      mapping[field.key] = null;
    }
  }
  return mapping;
}
