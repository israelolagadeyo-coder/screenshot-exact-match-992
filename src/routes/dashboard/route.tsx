import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bot,
  Database,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { ACTIVE_ORG_KEY, membershipsQuery, type Membership } from "@/lib/organizations";
import { OrgContext } from "@/lib/org-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/data", label: "Data", icon: Database },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/ai", label: "AI Analyst", icon: Bot },
  { to: "/dashboard/reports", label: "Reports", icon: FileText },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

const COMING_SOON = ["Automations", "Agents", "Integrations"];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}

      <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
        Coming soon
      </p>
      {COMING_SOON.map((label) => (
        <span
          key={label}
          className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/40"
          aria-disabled="true"
        >
          <Lock className="h-4 w-4" aria-hidden />
          {label}
        </span>
      ))}
    </nav>
  );
}

function DashboardLayout() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: memberships, isLoading } = useQuery(membershipsQuery(user?.id));

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!memberships) return;
    if (memberships.length === 0) {
      navigate({ to: "/onboarding" });
      return;
    }
    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_ORG_KEY) : null;
    const match = memberships.find((m) => m.organization_id === stored) ?? memberships[0]!;
    setActiveId(match.organization_id);
  }, [memberships, navigate]);

  const active: Membership | undefined = useMemo(
    () => memberships?.find((m) => m.organization_id === activeId),
    [memberships, activeId],
  );

  if (authLoading || isLoading || !active?.organizations) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-10 w-48" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const setActiveOrg = (id: string) => {
    localStorage.setItem(ACTIVE_ORG_KEY, id);
    setActiveId(id);
  };

  return (
    <OrgContext.Provider
      value={{
        organization: active.organizations,
        role: active.role,
        memberships: memberships ?? [],
        setActiveOrg,
      }}
    >
      <div className="flex min-h-screen bg-secondary/40">
        <aside className="hidden w-64 shrink-0 flex-col bg-sidebar lg:flex">
          <div className="border-b border-sidebar-border p-4">
            <Link to="/" aria-label="BizIntel AI home">
              <Logo variant="inverted" />
            </Link>
          </div>
          <SidebarNav />
          <div className="border-t border-sidebar-border p-3">
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Log out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-background px-4">
            <div className="flex items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 bg-sidebar p-0">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="border-b border-sidebar-border p-4">
                    <Logo variant="inverted" />
                  </div>
                  <SidebarNav onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>

              <Select value={activeId ?? undefined} onValueChange={setActiveOrg}>
                <SelectTrigger className="w-[200px]" aria-label="Active business">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(memberships ?? []).map((m) => (
                    <SelectItem key={m.organization_id} value={m.organization_id}>
                      {m.organizations?.name ?? "Business"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
              <Button asChild variant="outline" size="sm">
                <Link to="/onboarding">New business</Link>
              </Button>
            </div>
          </header>

          <main className="min-w-0 flex-1 p-4 sm:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </OrgContext.Provider>
  );
}
