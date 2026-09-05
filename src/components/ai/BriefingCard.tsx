import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EvidenceList } from "@/components/ai/EvidencePanel";
import { getExecutiveBriefing } from "@/lib/ai/analyst.functions";
import type { ExecutiveBriefing } from "@/lib/ai/types";

export function BriefingCard({ orgId, period }: { orgId: string; period: string }) {
  const fetchBriefing = useServerFn(getExecutiveBriefing);
  const query = useQuery({
    queryKey: ["ai-briefing", orgId, period],
    enabled: Boolean(orgId),
    staleTime: 120_000,
    queryFn: (): Promise<ExecutiveBriefing> =>
      fetchBriefing({ data: { organizationId: orgId, period } }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">AI business briefing</CardTitle>
            <CardDescription>Written from your calculated figures — no estimates.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/ai">Ask the analyst</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {query.error && (
          <p className="text-sm text-muted-foreground">
            The briefing is temporarily unavailable. Your analytics below are still accurate.
          </p>
        )}

        {query.data && (
          <>
            <p className="text-sm leading-relaxed">{query.data.summary}</p>
            <div className="grid gap-5 md:grid-cols-2">
              {query.data.sections.map((section) => (
                <div key={section.heading}>
                  <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.heading}
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <EvidenceList evidence={query.data.evidence} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
