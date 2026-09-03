import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ACTIVE_ORG_KEY, COUNTRIES, CURRENCIES, INDUSTRIES } from "@/lib/organizations";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: "Create your business — BizIntel AI" },
      { name: "description", content: "Set up your business workspace in BizIntel AI." },
      { property: "og:title", content: "Create your business — BizIntel AI" },
      { property: "og:description", content: "Name your business, choose your industry and currency, and get your dashboard." },
    ],
  }),
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState(INDUSTRIES[0]!);
  const [country, setCountry] = useState("Nigeria");
  const [currency, setCurrency] = useState("NGN");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const onCountryChange = (value: string) => {
    setCountry(value);
    const match = COUNTRIES.find((c) => c.name === value);
    if (match) setCurrency(match.currency);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const { data: org, error } = await supabase
      .from("organizations")
      .insert({
        name: name.trim(),
        industry,
        country,
        currency,
        logo_url: logoUrl.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !org) {
      setSaving(false);
      toast.error("We couldn't create your business. Please try again.");
      return;
    }

    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: user.id, role: "owner" });

    setSaving(false);
    if (memberError) {
      toast.error("Your business was created but we couldn't add you as owner.");
      return;
    }

    localStorage.setItem(ACTIVE_ORG_KEY, org.id);
    await queryClient.invalidateQueries({ queryKey: ["memberships"] });
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-secondary/40">
      <div className="mx-auto max-w-xl px-4 py-14">
        <Logo />
        <div className="panel mt-8 p-8">
          <h1 className="text-2xl font-bold">Create Your Business</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This becomes your workspace. All uploads, analytics and reports live inside it.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Business name</Label>
              <Input
                id="name"
                required
                placeholder="e.g. Adeola Stores Ltd"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
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
                <Label htmlFor="country">Country</Label>
                <Select value={country} onValueChange={onCountryChange}>
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
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
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Select currency" />
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
              <Label htmlFor="logo">Logo URL (optional)</Label>
              <Input
                id="logo"
                type="url"
                placeholder="https://…"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={saving}>
              {saving ? "Creating…" : "Continue to Dashboard"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
