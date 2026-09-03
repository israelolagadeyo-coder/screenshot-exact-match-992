/*
# Phase 2 — Data Ingestion: datasets, dataset_rows, storage bucket

## What this migration does

Creates the complete data ingestion storage layer for BizIntel AI Phase 2.
Datasets are organization-scoped business data files (sales, customers, expenses)
that users upload, validate, clean, and map to standard schemas before structured storage.

## New Tables

### datasets
Tracks each uploaded business data file and its processing lifecycle.
- id (uuid, PK)
- organization_id (uuid, FK -> organizations) — which org owns this dataset
- uploaded_by (uuid, FK -> auth.users) — who uploaded it
- name (text) — original filename or user-provided name
- file_path (text) — path in private Supabase Storage bucket
- file_size (bigint) — file size in bytes
- file_type (text) — 'csv' or 'xlsx'
- dataset_type (text) — 'sales' | 'customers' | 'expenses' | 'unknown'
- status (text) — 'uploading' | 'uploaded' | 'parsing' | 'parsed' | 'validating' | 'validated' | 'cleaning' | 'cleaned' | 'mapping' | 'processed' | 'error'
- row_count (integer) — number of data rows (excluding header)
- column_count (integer) — number of detected columns
- columns (jsonb) — array of {name, type, sample, missing, unique} for each detected column
- column_mapping (jsonb) — mapping of source column names to standard field names
- validation (jsonb) — validation summary {missingValues, duplicates, invalidDates, invalidNumbers, missingRequired, healthScore, issues: []}
- cleaning (jsonb) — cleaning summary {removedDuplicates, trimmedWhitespace, normalizedDates, removedEmptyRows, totalFixes}
- preview (jsonb) — first N rows for display
- error_message (text) — error details if status = 'error'
- created_at, updated_at (timestamptz)

### dataset_rows
Stores the actual structured row data after processing.
- id (uuid, PK)
- dataset_id (uuid, FK -> datasets ON DELETE CASCADE)
- organization_id (uuid, FK -> organizations) — denormalized for direct org-scoped queries
- row_index (integer) — original row number in source file
- data (jsonb) — the row's data as key/value pairs using mapped column names
- created_at (timestamptz)

## Storage
- Creates a private storage bucket `datasets` (NOT public) for uploaded business files.
- Storage policies allow authenticated users to read/write/manage files only within
  their organization's folder path: `org_id/dataset_id/filename`.

## Security (RLS)
- datasets: org membership required for all CRUD operations (uses existing is_org_member helper).
  Only owner/admin can delete datasets.
- dataset_rows: org membership required for SELECT/INSERT. DELETE cascades via FK.
- Storage policies: users can CRUD files only under their org folder path.
- No service-role credentials are exposed to the browser.

## Important Notes
1. All policies use the existing public.is_org_member() and public.has_org_role() helpers.
2. organization_id columns are NOT defaulted to auth.uid() — they must be provided explicitly
   because the uploader is a member, not necessarily the org owner.
3. No existing tables are modified. No existing RLS policies are changed.
*/
-- ───────────────────────────── DATASETS TABLE ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.datasets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  file_size       BIGINT NOT NULL DEFAULT 0,
  file_type       TEXT NOT NULL DEFAULT 'csv',
  dataset_type    TEXT NOT NULL DEFAULT 'unknown',
  status          TEXT NOT NULL DEFAULT 'uploading',
  row_count       INTEGER NOT NULL DEFAULT 0,
  column_count    INTEGER NOT NULL DEFAULT 0,
  columns         JSONB NOT NULL DEFAULT '[]'::jsonb,
  column_mapping  JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation      JSONB NOT NULL DEFAULT '{}'::jsonb,
  cleaning        JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview         JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT ALL ON public.datasets TO service_role;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_datasets_org ON public.datasets(organization_id);
CREATE INDEX IF NOT EXISTS idx_datasets_created_by ON public.datasets(uploaded_by);

-- Dataset RLS: org members can CRUD; only owner/admin can delete
DROP POLICY IF EXISTS "datasets_select_members" ON public.datasets;
CREATE POLICY "datasets_select_members" ON public.datasets
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "datasets_insert_members" ON public.datasets;
CREATE POLICY "datasets_insert_members" ON public.datasets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "datasets_update_members" ON public.datasets;
CREATE POLICY "datasets_update_members" ON public.datasets
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "datasets_delete_admins" ON public.datasets;
CREATE POLICY "datasets_delete_admins" ON public.datasets
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

-- ───────────────────────────── DATASET_ROWS TABLE ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.dataset_rows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id      UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  row_index       INTEGER NOT NULL DEFAULT 0,
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.dataset_rows TO authenticated;
GRANT ALL ON public.dataset_rows TO service_role;
ALTER TABLE public.dataset_rows ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset ON public.dataset_rows(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_org ON public.dataset_rows(organization_id);

-- dataset_rows RLS: org members can SELECT/INSERT; admin/owner can DELETE (via dataset delete cascade)
DROP POLICY IF EXISTS "dataset_rows_select_members" ON public.dataset_rows;
CREATE POLICY "dataset_rows_select_members" ON public.dataset_rows
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "dataset_rows_insert_members" ON public.dataset_rows;
CREATE POLICY "dataset_rows_insert_members" ON public.dataset_rows
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "dataset_rows_delete_admins" ON public.dataset_rows;
CREATE POLICY "dataset_rows_delete_admins" ON public.dataset_rows
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = dataset_rows.dataset_id
      AND public.has_org_role(d.organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[])
    )
  );

-- ───────────────────────────── TRIGGER ─────────────────────────────
DROP TRIGGER IF EXISTS trg_datasets_updated ON public.datasets;
CREATE TRIGGER trg_datasets_updated
  BEFORE UPDATE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ───────────────────────────── STORAGE BUCKET ─────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('datasets', 'datasets', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: org-scoped folder access
-- Files are stored as: org_id/dataset_id/filename
DROP POLICY IF EXISTS "datasets_storage_read_members" ON storage.objects;
CREATE POLICY "datasets_storage_read_members" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'datasets'
    AND public.is_org_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );

DROP POLICY IF EXISTS "datasets_storage_create_members" ON storage.objects;
CREATE POLICY "datasets_storage_create_members" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'datasets'
    AND public.is_org_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );

DROP POLICY IF EXISTS "datasets_storage_update_members" ON storage.objects;
CREATE POLICY "datasets_storage_update_members" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'datasets'
    AND public.is_org_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'datasets'
    AND public.is_org_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );

DROP POLICY IF EXISTS "datasets_storage_delete_admins" ON storage.objects;
CREATE POLICY "datasets_storage_delete_admins" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'datasets'
    AND public.has_org_role(
      (storage.foldername(name))[1]::uuid,
      auth.uid(),
      ARRAY['owner','admin']::public.org_role[]
    )
  );
