import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Markdown } from "@/components/ai/Markdown";
import { EvidencePanel } from "@/components/ai/EvidencePanel";
import { useOrg } from "@/lib/org-context";
import { cn } from "@/lib/utils";
import {
  askAnalyst,
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
} from "@/lib/ai/analyst.functions";
import { SUGGESTED_QUESTIONS, type AiConversation, type AiMessage, type AskResult } from "@/lib/ai/types";

export const Route = createFileRoute("/dashboard/ai")({
  component: AiPage,
  head: () => ({
    meta: [
      { title: "AI Analyst — BizIntel AI" },
      { name: "description", content: "Ask your business questions and get evidence-based answers." },
      { property: "og:title", content: "AI Analyst — BizIntel AI" },
      {
        property: "og:description",
        content: "An AI business analyst grounded in your calculated metrics — never invented numbers.",
      },
    ],
  }),
});

function AiPage() {
  const { organization } = useOrg();
  const orgId = organization.id;
  const queryClient = useQueryClient();

  const fetchConversations = useServerFn(listConversations);
  const fetchMessages = useServerFn(listMessages);
  const startConversation = useServerFn(createConversation);
  const removeConversation = useServerFn(deleteConversation);
  const ask = useServerFn(askAnalyst);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery<AiConversation[]>({
    queryKey: ["ai-conversations", orgId],
    queryFn: () => fetchConversations({ data: { organizationId: orgId } }),
  });

  const messages = useQuery<AiMessage[]>({
    queryKey: ["ai-messages", activeId],
    enabled: Boolean(activeId),
    queryFn: () => fetchMessages({ data: { conversationId: activeId! } }),
  });

  const askMutation = useMutation({
    mutationFn: (question: string): Promise<AskResult> =>
      ask({ data: { organizationId: orgId, conversationId: activeId, question } }),
    onSuccess: (result) => {
      setPending(null);
      setActiveId(result.conversationId);
      queryClient.invalidateQueries({ queryKey: ["ai-messages", result.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["ai-conversations", orgId] });
      inputRef.current?.focus();
    },
    onError: (error: Error) => {
      setPending(null);
      toast.error(error.message || "AI analysis is temporarily unavailable.");
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data, pending]);

  const thread: AiMessage[] = useMemo(() => messages.data ?? [], [messages.data]);
  const lastAssistant = [...thread].reverse().find((m) => m.role === "assistant");

  function submit(question: string) {
    const value = question.trim();
    if (!value || askMutation.isPending) return;
    setDraft("");
    setPending(value);
    askMutation.mutate(value);
  }

  async function newConversation() {
    try {
      const created = await startConversation({ data: { organizationId: orgId } });
      setActiveId(created.id);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations", orgId] });
      inputRef.current?.focus();
    } catch {
      toast.error("We couldn't start a new analysis.");
    }
  }

  async function remove(id: string) {
    try {
      await removeConversation({ data: { conversationId: id } });
      if (activeId === id) setActiveId(null);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations", orgId] });
    } catch {
      toast.error("We couldn't delete that conversation.");
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-3">
      <Button onClick={newConversation} className="w-full justify-start gap-2">
        <MessageSquarePlus className="h-4 w-4" aria-hidden />
        New analysis
      </Button>
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Recent conversations
      </p>
      <ScrollArea className="h-[calc(100vh-20rem)] pr-2">
        <ul className="space-y-1">
          {conversations.isLoading &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          {conversations.data?.length === 0 && (
            <li className="px-1 text-sm text-muted-foreground">No conversations yet.</li>
          )}
          {conversations.data?.map((c) => (
            <li key={c.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "flex-1 truncate rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeId === c.id && "bg-muted font-medium",
                )}
                aria-current={activeId === c.id ? "true" : undefined}
              >
                {c.title}
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete conversation ${c.title}`}
                onClick={() => remove(c.id)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="AI Analyst"
        description="Evidence-based answers built on your calculated metrics."
        action={
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Conversations</Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-4">
                <SheetTitle className="mb-4">Conversations</SheetTitle>
                {sidebar}
              </SheetContent>
            </Sheet>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
        <aside className="hidden lg:block">{sidebar}</aside>

        <section className="flex min-h-[32rem] flex-col gap-4">
          <Card className="flex-1">
            <CardContent className="space-y-6 p-4 sm:p-6">
              {thread.length === 0 && !pending && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold">
                      Ask about {organization.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Every answer is built from your uploaded data. If a figure isn't in your data, the
                      analyst says so instead of guessing.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <Button key={q} variant="outline" size="sm" onClick={() => submit(q)}>
                        {q}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.isLoading && activeId && <Skeleton className="h-24 w-full" />}

              {thread.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "rounded-xl",
                    message.role === "user"
                      ? "ml-auto max-w-[85%] bg-primary px-4 py-3 text-primary-foreground"
                      : "max-w-full",
                  )}
                >
                  {message.role === "user" ? (
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  ) : (
                    <>
                      <Markdown text={message.content} />
                      {message.tools_used.length > 0 && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Based on: {message.tools_used.map((t) => t.summary).join("; ")}
                        </p>
                      )}
                    </>
                  )}
                </article>
              ))}

              {pending && (
                <>
                  <article className="ml-auto max-w-[85%] rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground">
                    {pending}
                  </article>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Checking your figures…
                  </p>
                </>
              )}

              {askMutation.isError && !pending && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>That analysis didn't complete.</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => submit(askMutation.variables ?? "")}
                    disabled={!askMutation.variables}
                  >
                    Retry
                  </Button>
                </div>
              )}
              <div ref={bottomRef} />
            </CardContent>
          </Card>

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit(draft);
            }}
          >
            <label htmlFor="analyst-question" className="sr-only">
              Ask a business question
            </label>
            <Textarea
              id="analyst-question"
              ref={inputRef}
              rows={2}
              value={draft}
              placeholder="Ask about revenue, products, customers or expenses…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit(draft);
                }
              }}
              className="min-h-[3.5rem] resize-none"
            />
            <Button type="submit" size="icon" disabled={askMutation.isPending || !draft.trim()} aria-label="Send question">
              {askMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </form>
        </section>

        <aside className="hidden xl:block">
          <EvidencePanel
            evidence={lastAssistant?.evidence ?? []}
            tools={lastAssistant?.tools_used ?? []}
          />
        </aside>
      </div>
    </div>
  );
}
