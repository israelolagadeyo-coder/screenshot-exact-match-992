-- =====================================================================
-- PHASE 2 — DATA INGESTION
-- Adds datasets + dataset_rows tables and a private storage bucket.
-- Every dataset belongs to an organization and is protected by RLS that
-- reuses the Phase 1 helpers public.is_org_member / public.has_org_role.
-- Existing Phase 1 tables, policies and functions are left untouched.
-- =====================================================================

-- Enums --------------------------------------------------------------
CREATE TYPE public.dataset_kind AS ENUM ('sales', 'customers', 'expenses');
CREATE TYPE public.dataset_status AS ENUM ('uploaded', 'processing', 'processed', 'failed');

-- DATASETS -----------------------------------------------------------
CREATE TABLE public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.dataset_kind NOT NULL,
  status public.dataset_status NOT NULL DEFAULT 'uploaded',
  original_filename TEXT NOT NULL,
  file_path TEXT,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  column_count INTEGER NOT NULL DEFAULT 0,
  -- Detected source columns with inferred types: [{ name, type }]
  source_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Mapping of canonical field -> source column name
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Data health summary produced during validation
  health JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT ALL ON public.datasets TO service_role;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_datasets_org ON public.datasets(organization_id);
CREATE INDEX idx_datasets_created_at ON public.datasets(created_at DESC);

-- DATASET ROWS -------------------------------------------------------
-- Cleaned / structured rows stored as jsonb keyed by canonical fields.
-- organization_id is denormalised so RLS never has to join datasets.
CREATE TABLE public.dataset_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataset_rows TO authenticated;
GRANT ALL ON public.dataset_rows TO service_role;
ALTER TABLE public.dataset_rows ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_dataset_rows_dataset ON public.dataset_rows(dataset_id);
CREATE INDEX idx_dataset_rows_org ON public.dataset_rows(organization_id);

-- updated_at trigger (reuses Phase 1 public.set_updated_at) -----------
CREATE TRIGGER trg_datasets_updated BEFORE UPDATE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: datasets ------------------------------------------------------
CREATE POLICY "datasets_select_members" ON public.datasets FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "datasets_insert_contributors" ON public.datasets FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','analyst']::public.org_role[])
  );

CREATE POLICY "datasets_update_contributors" ON public.datasets FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','analyst']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','analyst']::public.org_role[]));

CREATE POLICY "datasets_delete_admins" ON public.datasets FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

-- RLS: dataset_rows --------------------------------------------------
CREATE POLICY "dataset_rows_select_members" ON public.dataset_rows FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "dataset_rows_insert_contributors" ON public.dataset_rows FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','analyst']::public.org_role[]));

CREATE POLICY "dataset_rows_update_contributors" ON public.dataset_rows FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','analyst']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','analyst']::public.org_role[]));

CREATE POLICY "dataset_rows_delete_contributors" ON public.dataset_rows FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','analyst']::public.org_role[]));

-- =====================================================================
-- PRIVATE STORAGE BUCKET for original uploaded files.
-- Path convention: {organization_id}/{dataset_id}/{filename}
-- Access is scoped by the first path segment (the organization id).
-- The bucket is private (public = false); files are only reachable via
-- authenticated requests or short-lived signed URLs.
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('datasets', 'datasets', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "dataset_files_select_members" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'datasets'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "dataset_files_insert_contributors" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'datasets'
    AND public.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), ARRAY['owner','admin','analyst']::public.org_role[])
  );

CREATE POLICY "dataset_files_update_contributors" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'datasets'
    AND public.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), ARRAY['owner','admin','analyst']::public.org_role[])
  );

CREATE POLICY "dataset_files_delete_admins" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'datasets'
    AND public.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), ARRAY['owner','admin']::public.org_role[])
  );
