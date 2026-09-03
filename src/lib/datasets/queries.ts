import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DatasetListItem = {
  id: string;
  name: string;
  dataset_type: string;
  status: string;
  row_count: number;
  column_count: number;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
  validation: {
    healthScore?: number;
    missingValues?: number;
    duplicates?: number;
    invalidDates?: number;
    invalidNumbers?: number;
    missingRequired?: number;
  };
};

export function datasetsQuery(organizationId: string | undefined) {
  return queryOptions({
    queryKey: ["datasets", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<DatasetListItem[]> => {
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DatasetListItem[];
    },
  });
}

export function useDatasets(organizationId: string | undefined) {
  return useQuery(datasetsQuery(organizationId));
}

export type DatasetDetail = DatasetListItem & {
  columns: Array<{
    name: string;
    type: string;
    sample: string | number | boolean | null;
    missing: number;
    unique: number;
  }>;
  column_mapping: Record<string, string>;
  cleaning: {
    removedDuplicates?: number;
    trimmedWhitespace?: number;
    normalizedDates?: number;
    removedEmptyRows?: number;
    totalFixes?: number;
  };
  preview: Record<string, string | number | boolean | null>[];
  error_message: string | null;
  uploaded_by: string;
};

export function datasetDetailQuery(datasetId: string | undefined) {
  return queryOptions({
    queryKey: ["dataset-detail", datasetId],
    enabled: Boolean(datasetId),
    queryFn: async (): Promise<DatasetDetail | null> => {
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .eq("id", datasetId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DatasetDetail | null;
    },
  });
}
