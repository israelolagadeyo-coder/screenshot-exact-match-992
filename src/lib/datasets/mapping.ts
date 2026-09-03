import type { ColumnMapping, DatasetType, DetectedColumn, StandardField } from "./types";
import { DATASET_SCHEMAS } from "./types";

function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[_\-\s]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function similarity(a: string, b: string): number {
  const normA = normalizeColumnName(a);
  const normB = normalizeColumnName(b);

  if (normA === normB) return 1.0;
  if (normB.includes(normA) || normA.includes(normB)) return 0.85;

  if (normB.startsWith(normA) || normA.startsWith(normB)) return 0.8;

  const setA = new Set(normA.split("_"));
  const setB = new Set(normB.split("_"));
  let matches = 0;
  for (const word of setA) {
    if (setB.has(word)) matches++;
  }
  const overlap = matches / Math.max(setA.size, setB.size);
  if (overlap > 0) return 0.6 + overlap * 0.2;

  return 0;
}

export function suggestMapping(columns: DetectedColumn[], datasetType: DatasetType): ColumnMapping {
  const mapping: ColumnMapping = {};
  if (datasetType === "unknown") return mapping;

  const fields = DATASET_SCHEMAS[datasetType];

  for (const field of fields) {
    let bestColumn: string | null = null;
    let bestScore = 0;

    for (const col of columns) {
      if (mapping[col.name]) continue;

      let score = similarity(col.name, field.key);
      for (const alias of field.aliases) {
        score = Math.max(score, similarity(col.name, alias));
      }

      if (col.type === field.type && score > 0) {
        score += 0.1;
      }

      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        bestColumn = col.name;
      }
    }

    if (bestColumn) {
      mapping[bestColumn] = field.key;
    }
  }

  return mapping;
}

export function detectDatasetType(columns: DetectedColumn[]): DatasetType {
  const normNames = columns.map((c) => normalizeColumnName(c.name));
  const typeScores: Record<Exclude<DatasetType, "unknown">, number> = {
    sales: 0,
    customers: 0,
    expenses: 0,
  };

  for (const [type, fields] of Object.entries(DATASET_SCHEMAS) as [
    Exclude<DatasetType, "unknown">,
    StandardField[],
  ][]) {
    for (const field of fields) {
      const allAliases = [field.key, ...field.aliases];
      for (const alias of allAliases) {
        const normAlias = normalizeColumnName(alias);
        if (normNames.includes(normAlias)) {
          typeScores[type] += field.required ? 2 : 1;
          break;
        }
        for (const normName of normNames) {
          if (normName.includes(normAlias) || normAlias.includes(normName)) {
            typeScores[type] += field.required ? 1.5 : 0.75;
            break;
          }
        }
      }
    }
  }

  const sorted = Object.entries(typeScores).sort(([, a], [, b]) => b - a);
  const [bestType, bestScore] = sorted[0]!;
  return bestScore >= 3 ? (bestType as DatasetType) : "unknown";
}

export function getUnmappedColumns(
  columns: DetectedColumn[],
  mapping: ColumnMapping,
): DetectedColumn[] {
  return columns.filter((c) => !mapping[c.name]);
}

export function getMappedFields(
  mapping: ColumnMapping,
  datasetType: DatasetType,
): { field: StandardField; sourceColumn: string }[] {
  if (datasetType === "unknown") return [];
  const fields = DATASET_SCHEMAS[datasetType];
  const result: { field: StandardField; sourceColumn: string }[] = [];

  for (const field of fields) {
    const sourceCol = Object.entries(mapping).find(([, v]) => v === field.key)?.[0];
    if (sourceCol) {
      result.push({ field, sourceColumn: sourceCol });
    }
  }

  return result;
}
