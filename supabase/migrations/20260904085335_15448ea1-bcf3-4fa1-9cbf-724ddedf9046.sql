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

-- ───────────────────────────── STORAGE POLICIES ─────────────────────────────
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