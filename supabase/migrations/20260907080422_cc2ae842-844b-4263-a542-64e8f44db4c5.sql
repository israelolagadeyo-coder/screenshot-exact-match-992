CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('executive','sales','customers','products','expenses')),
  period_key TEXT NOT NULL DEFAULT 'last30',
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('queued','generating','completed','failed')),
  include_ai BOOLEAN NOT NULL DEFAULT true,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_path TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reports_org_created_idx ON public.reports (organization_id, created_at DESC);
CREATE INDEX reports_org_type_idx ON public.reports (organization_id, report_type);
CREATE INDEX reports_org_status_idx ON public.reports (organization_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their organisation reports"
ON public.reports FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Owners admins and analysts can create reports"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','analyst']::public.org_role[])
);

CREATE POLICY "Report creators owners and admins can update reports"
ON public.reports FOR UPDATE TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (created_by = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]))
)
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Owners and admins can delete reports"
ON public.reports FOR DELETE TO authenticated
USING (
  public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[])
  OR (created_by = auth.uid() AND public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','analyst']::public.org_role[]))
);

CREATE TRIGGER reports_set_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();