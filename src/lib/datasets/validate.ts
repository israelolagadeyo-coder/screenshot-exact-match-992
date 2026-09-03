import type {
  ColumnMapping,
  CleaningSummary,
  DatasetType,
  DetectedColumn,
  ParsedFile,
  StandardField,
  ValidationIssue,
  ValidationSummary,
} from "./types";
import { DATASET_SCHEMAS } from "./types";

function isInvalidDate(value: string | number | boolean | null): boolean {
  if (value === null || value === "") return false;
  const str = String(value).trim();
  if (str === "") return false;
  const d = new Date(str);
  return isNaN(d.getTime());
}

function isInvalidNumber(value: string | number | boolean | null): boolean {
  if (value === null || value === "") return false;
  const str = String(value)
    .trim()
    .replace(/[,$€₦£\s]/g, "");
  if (str === "") return true;
  return isNaN(Number(str)) || !isFinite(Number(str));
}

export function validateData(
  parsed: ParsedFile,
  datasetType: DatasetType,
  mapping: ColumnMapping,
): ValidationSummary {
  const issues: ValidationIssue[] = [];
  let missingValues = 0;
  let duplicates = 0;
  let invalidDates = 0;
  let invalidNumbers = 0;
  let missingRequired = 0;

  const fields = datasetType !== "unknown" ? DATASET_SCHEMAS[datasetType] : [];
  const requiredFields = fields.filter((f) => f.required);

  const columnMap = new Map(parsed.columns.map((c) => [c.name, c]));

  for (const field of requiredFields) {
    const sourceCol = mapping[field.key];
    if (!sourceCol) {
      parsed.rows.forEach((_, idx) => {
        missingRequired++;
        issues.push({
          type: "missing_required",
          column: field.key,
          rowIndex: idx,
          message: `Required field "${field.label}" is not mapped`,
          value: null,
        });
      });
      continue;
    }

    const col = columnMap.get(sourceCol);
    if (!col) continue;

    col.values.forEach((val, idx) => {
      if (val === null || val === "") {
        missingRequired++;
        issues.push({
          type: "missing_required",
          column: sourceCol,
          rowIndex: idx,
          message: `Required field "${field.label}" is missing in row ${idx + 1}`,
          value: null,
        });
      }
    });
  }

  for (const col of parsed.columns) {
    col.values.forEach((val, idx) => {
      if (val === null || val === "") {
        missingValues++;
        if (issues.length < 200) {
          issues.push({
            type: "missing",
            column: col.name,
            rowIndex: idx,
            message: `Missing value in "${col.name}" at row ${idx + 1}`,
            value: null,
          });
        }
      } else if (col.type === "date" && isInvalidDate(val)) {
        invalidDates++;
        if (issues.length < 200) {
          issues.push({
            type: "invalid_date",
            column: col.name,
            rowIndex: idx,
            message: `Invalid date "${val}" in "${col.name}" at row ${idx + 1}`,
            value: String(val),
          });
        }
      } else if (col.type === "number" && isInvalidNumber(val)) {
        invalidNumbers++;
        if (issues.length < 200) {
          issues.push({
            type: "invalid_number",
            column: col.name,
            rowIndex: idx,
            message: `Invalid number "${val}" in "${col.name}" at row ${idx + 1}`,
            value: String(val),
          });
        }
      }
    });
  }

  const seen = new Set<string>();
  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i]!;
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      duplicates++;
      if (issues.length < 200) {
        issues.push({
          type: "duplicate",
          column: "*",
          rowIndex: i,
          message: `Duplicate record at row ${i + 1}`,
          value: null,
        });
      }
    } else {
      seen.add(key);
    }
  }

  const totalCells = parsed.rowCount * parsed.columnCount;
  const errorWeight = (invalidDates + invalidNumbers + missingRequired) * 2;
  const duplicateWeight = duplicates;
  const missingWeight = missingValues * 0.3;
  const penalty =
    totalCells > 0
      ? Math.min(100, ((errorWeight + duplicateWeight + missingWeight) / totalCells) * 100)
      : 0;
  const healthScore = Math.max(0, Math.round(100 - penalty));

  return {
    missingValues,
    duplicates,
    invalidDates,
    invalidNumbers,
    missingRequired,
    healthScore,
    issues,
  };
}

export function cleanData(
  parsed: ParsedFile,
  validation: ValidationSummary,
): { cleanedRows: Record<string, string | number | boolean | null>[]; summary: CleaningSummary } {
  let removedDuplicates = 0;
  let trimmedWhitespace = 0;
  let normalizedDates = 0;
  let removedEmptyRows = 0;

  const seen = new Set<string>();
  const cleanedRows: Record<string, string | number | boolean | null>[] = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i]!;
    const hasAnyValue = Object.values(row).some((v) => v !== null && v !== "");
    if (!hasAnyValue) {
      removedEmptyRows++;
      continue;
    }

    const key = JSON.stringify(row);
    if (seen.has(key)) {
      removedDuplicates++;
      continue;
    }
    seen.add(key);

    const cleanedRow: Record<string, string | number | boolean | null> = {};
    for (const [colName, val] of Object.entries(row)) {
      if (val === null) {
        cleanedRow[colName] = null;
        continue;
      }

      let cleanedVal = val;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed !== val) trimmedWhitespace++;
        cleanedVal = trimmed;

        if (trimmed === "") {
          cleanedRow[colName] = null;
          continue;
        }

        const col = parsed.columns.find((c) => c.name === colName);
        if (col?.type === "date" && !isNaN(new Date(trimmed).getTime())) {
          const d = new Date(trimmed);
          const iso = d.toISOString().split("T")[0]!;
          if (iso !== trimmed) normalizedDates++;
          cleanedVal = iso;
        }
      }

      cleanedRow[colName] = cleanedVal;
    }

    cleanedRows.push(cleanedRow);
  }

  return {
    cleanedRows,
    summary: {
      removedDuplicates,
      trimmedWhitespace,
      normalizedDates,
      removedEmptyRows,
      totalFixes: removedDuplicates + trimmedWhitespace + normalizedDates + removedEmptyRows,
    },
  };
}
