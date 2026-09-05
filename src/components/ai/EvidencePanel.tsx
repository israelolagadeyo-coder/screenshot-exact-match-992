import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiEvidence, AiToolCallRecord } from "@/lib/ai/types";

const CONFIDENCE_LABEL: Record<AiEvidence["confidence"], string> = {
  known: "Known",
  inferred: "Inferred",
  unknown: "Unknown",
};

export function ConfidenceBadge({ confidence }: { confidence: AiEvidence["confidence"] }) {
  return (
    <Badge
      variant={confidence === "known" ? "default" : confidence === "inferred" ? "secondary" : "outline"}
      className="text-[10px] uppercase tracking-wide"
    >
      {CONFIDENCE_LABEL[confidence]}
    </Badge>
  );
}

export function EvidenceList({ evidence }: { evidence: AiEvidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <dl className="space-y-3">
      {evidence.map((item, i) => (
        <div key={`${item.label}-${i}`} className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
            <ConfidenceBadge confidence={item.confidence} />
          </div>
          <dd className="mt-1 font-display text-base font-semibold text-foreground">{item.value}</dd>
          {(item.period || item.detail) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {[item.period, item.detail].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      ))}
    </dl>
  );
}

export function EvidencePanel({
  evidence,
  tools,
}: {
  evidence: AiEvidence[];
  tools: AiToolCallRecord[];
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Evidence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask a question and the figures behind the answer appear here.
          </p>
        ) : (
          <EvidenceList evidence={evidence} />
        )}

        {tools.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              How this was checked
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {tools.map((tool, i) => (
                <li key={`${tool.tool}-${i}`}>· {tool.summary}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
