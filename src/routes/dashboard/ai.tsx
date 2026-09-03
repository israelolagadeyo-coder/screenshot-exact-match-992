import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PhaseNotice } from "@/components/dashboard/PageHeader";

export const Route = createFileRoute("/dashboard/ai")({
  component: AiPage,
  head: () => ({
    meta: [
      { title: "AI Analyst — BizIntel AI" },
      { name: "description", content: "Ask your business questions and get evidence-based answers." },
      { property: "og:title", content: "AI Analyst — BizIntel AI" },
      { property: "og:description", content: "An AI business analyst grounded in your calculated metrics — never invented numbers." },
    ],
  }),
});

function AiPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="AI Analyst"
        description="Evidence-based answers built on your calculated metrics."
      />
      <PhaseNotice
        phase="Next: AI business analyst"
        items={[
          "Conversation sidebar and history",
          "Suggested business questions",
          "Finding / Evidence / Explanation / Recommendation answers",
          "Known, inferred and unknown labelling",
          "Server-side analytics tools",
          "Stored conversations",
        ]}
      />
    </div>
  );
}
