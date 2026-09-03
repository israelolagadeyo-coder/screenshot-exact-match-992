import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrgRole = "owner" | "admin" | "analyst" | "viewer";

export type Organization = {
  id: string;
  name: string;
  industry: string | null;
  country: string;
  currency: string;
  logo_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Membership = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  organizations: Organization | null;
};

export const membershipsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["memberships", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("*, organizations(*)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

export const profileQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const orgMembersQuery = (orgId: string | undefined) =>
  queryOptions({
    queryKey: ["org-members", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const ACTIVE_ORG_KEY = "bizintel.active_org";

export const INDUSTRIES = [
  "Retail & E-commerce",
  "Wholesale & Distribution",
  "Manufacturing",
  "Hospitality & Food",
  "Professional Services",
  "Education",
  "Healthcare",
  "Real Estate",
  "Logistics",
  "Financial Services",
  "Other",
];

export const COUNTRIES = [
  { name: "Nigeria", currency: "NGN" },
  { name: "Ghana", currency: "GHS" },
  { name: "Kenya", currency: "KES" },
  { name: "South Africa", currency: "ZAR" },
  { name: "United Kingdom", currency: "GBP" },
  { name: "United States", currency: "USD" },
  { name: "Canada", currency: "CAD" },
];

export const CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "GBP", "USD", "EUR", "CAD"];
