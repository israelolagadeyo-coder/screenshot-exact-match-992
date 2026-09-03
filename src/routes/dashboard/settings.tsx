import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org-context";
import {
  CURRENCIES,
  COUNTRIES,
  INDUSTRIES,
  orgMembersQuery,
  profileQuery,
} from "@/lib/organizations";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — BizIntel AI" },
      { name: "description", content: "Manage your business profile, account and team roles." },
      { property: "og:title", content: "Settings — BizIntel AI" },
      { property: "og:description", content: "Business details, account information and organisation members." },
    ],
  }),
});

function SettingsPage() {
  const { organization, role } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = role === "owner" || role === "admin";

  const [name, setName] = useState(organization.name);
  const [industry, setIndustry] = useState(organization.industry ?? INDUSTRIES[0]!);
  const [country, setCountry] = useState(organization.country);
  const [currency, setCurrency] = useState(organization.currency);
  const [logoUrl, setLogoUrl] = useState(organization.logo_url ?? "");
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    setName(organization.name);
    setIndustry(organization.industry ?? INDUSTRIES[0]!);
    setCountry(organization.country);
    setCurrency(organization.currency);
    setLogoUrl(organization.logo_url ?? "");
  }, [organization]);

  const { data: profile } = useQuery(profileQuery(user?.id));
  const { data: members } = useQuery(orgMembersQuery(organization.id));

  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile]);

  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOrg(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name: name.trim(),
        industry,
        country,
        currency,
        logo_url: logoUrl.trim() || null,
      })
      .eq("id", organization.id);
    setSavingOrg(false);
    if (error) {
      toast.error("We couldn't save your business details.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["memberships"] });
    toast.success("Business details updated.");
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, full_name: fullName.trim() });
    setSavingProfile(false);
    if (error) {
      toast.error("We couldn't update your profile.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profile updated.");
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Please use a password with at least 8 characters.");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) {
      toast.error("We couldn't update your password.");
      return;
    }
    setPassword("");
    toast.success("Password updated.");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Business, account and team configuration." />

      <Tabs defaultValue="business" className="mt-8">
        <TabsList>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="team">Organisation</TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          <form onSubmit={saveOrg} className="panel space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="orgName">Business name</Label>
              <Input
                id="orgName"
                value={name}
                disabled={!canManage}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgIndustry">Industry</Label>
              <Select value={industry} onValueChange={setIndustry} disabled={!canManage}>
                <SelectTrigger id="orgIndustry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="orgCountry">Country</Label>
                <Select value={country} onValueChange={setCountry} disabled={!canManage}>
                  <SelectTrigger id="orgCountry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgCurrency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency} disabled={!canManage}>
                  <SelectTrigger id="orgCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgLogo">Logo URL</Label>
              <Input
                id="orgLogo"
                type="url"
                value={logoUrl}
                disabled={!canManage}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
            {canManage ? (
              <Button type="submit" disabled={savingOrg}>
                {savingOrg ? "Saving…" : "Save changes"}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only owners and admins can change business details.
              </p>
            )}
          </form>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <form onSubmit={saveProfile} className="panel space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accEmail">Email</Label>
              <Input id="accEmail" value={user?.email ?? ""} disabled />
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </form>

          <form onSubmit={savePassword} className="panel space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline" disabled={savingPassword || !password}>
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="team">
          <div className="panel p-6">
            <h2 className="text-base font-semibold">Members</h2>
            <ul className="mt-4 divide-y divide-border">
              {(members ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="truncate">
                    {m.user_id === user?.id ? "You" : `Member ${m.user_id.slice(0, 8)}`}
                  </span>
                  <Badge variant="secondary">{m.role}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Member invitations arrive with the data and collaboration phase. Roles available:
              owner, admin, analyst, viewer.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
