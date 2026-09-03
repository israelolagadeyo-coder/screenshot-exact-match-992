import { createContext, useContext } from "react";
import type { Membership, OrgRole, Organization } from "@/lib/organizations";

type OrgContextValue = {
  organization: Organization;
  role: OrgRole;
  memberships: Membership[];
  setActiveOrg: (id: string) => void;
};

export const OrgContext = createContext<OrgContextValue | null>(null);

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside the dashboard layout");
  return ctx;
}

export function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}
