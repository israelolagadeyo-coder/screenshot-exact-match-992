import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AiConversation, AiEvidence, AiMessage, AiToolCallRecord, AskResult, ExecutiveBriefing } from "./types";

/**
 * All AI work runs behind an authenticated server function. The organisation is
 * verified against the caller's own membership (RLS), never trusted from the browser,
 * and the AI key stays server-side.
 */

const FRIENDLY_ERROR = "AI analysis is temporarily unavailable. Your underlying analytics are still available.";

type OrgInput = { organizationId: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveOrg(supabase: any, organizationId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, industry, country, currency")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) throw new Error("You do not have access to this business.");
  return data as { id: string; name: string; industry: string | null; country: string; currency: string };
}

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OrgInput) => input)
  .handler(async ({ data, context }): Promise<AiConversation[]> => {
    await resolveOrg(context.supabase, data.organizationId);
    const { data: rows, error } = await context.supabase
      .from("ai_conversations")
      .select("id, title, last_message_at, created_at")
      .eq("organization_id", data.organizationId)
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("We couldn't load your conversations.");
    return (rows ?? []) as AiConversation[];
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }): Promise<AiMessage[]> => {
    const { data: rows, error } = await context.supabase
      .from("ai_messages")
      .select("id, conversation_id, role, content, evidence, tools_used, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error("We couldn't load this conversation.");
    return (rows ?? []).map((row: Record<string, unknown>) => ({
      id: String(row["id"]),
      conversation_id: String(row["conversation_id"]),
      role: row["role"] as "user" | "assistant",
      content: String(row["content"] ?? ""),
      evidence: (row["evidence"] ?? []) as AiEvidence[],
      tools_used: (row["tools_used"] ?? []) as AiToolCallRecord[],
      created_at: String(row["created_at"]),
    }));
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OrgInput & { title?: string }) => input)
  .handler(async ({ data, context }): Promise<AiConversation> => {
    await resolveOrg(context.supabase, data.organizationId);
    const { data: row, error } = await context.supabase
      .from("ai_conversations")
      .insert({
        organization_id: data.organizationId,
        user_id: context.userId,
        title: (data.title ?? "New analysis").slice(0, 80),
      })
      .select("id, title, last_message_at, created_at")
      .single();
    if (error || !row) throw new Error("We couldn't start a new analysis.");
    return row as AiConversation;
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ai_conversations").delete().eq("id", data.conversationId);
    if (error) throw new Error("We couldn't delete that conversation.");
    return { ok: true };
  });

export const askAnalyst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OrgInput & { conversationId: string | null; question: string }) => {
    const question = (input.question ?? "").trim();
    if (!question) throw new Error("Please type a question.");
    if (question.length > 1000) throw new Error("Please shorten your question.");
    return { ...input, question };
  })
  .handler(async ({ data, context }): Promise<AskResult> => {
    const { supabase, userId } = context;
    const org = await resolveOrg(supabase, data.organizationId);

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error(FRIENDLY_ERROR);

    // Simple organisation/user aware rate limit.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if ((count ?? 0) >= 12) {
      throw new Error("You're asking questions faster than the analyst can work. Please wait a moment.");
    }

    // Conversation
    let conversationId = data.conversationId;
    if (!conversationId) {
      const { data: created, error } = await supabase
        .from("ai_conversations")
        .insert({
          organization_id: org.id,
          user_id: userId,
          title: data.question.slice(0, 60),
        })
        .select("id")
        .single();
      if (error || !created) throw new Error("We couldn't start a new analysis.");
      conversationId = created.id as string;
    }

    const { data: historyRows } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      organization_id: org.id,
      user_id: userId,
      role: "user",
      content: data.question,
    });

    const { runAnalyst, AnalystUnavailable } = await import("./engine.server");
    const started = Date.now();

    try {
      const result = await runAnalyst({
        ctx: { supabase, orgId: org.id, org },
        history: ((historyRows ?? []) as { role: "user" | "assistant"; content: string }[]).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        question: data.question,
        apiKey,
      });

      const { data: saved, error: saveError } = await supabase
        .from("ai_messages")
        .insert({
          conversation_id: conversationId,
          organization_id: org.id,
          user_id: userId,
          role: "assistant",
          content: result.answer,
          evidence: result.evidence,
          tools_used: result.toolCalls,
        })
        .select("id, conversation_id, role, content, evidence, tools_used, created_at")
        .single();
      if (saveError) console.error("[analyst] could not save answer", saveError);

      await supabase
        .from("ai_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);

      if (result.toolCalls.length > 0) {
        await supabase.from("ai_tool_calls").insert(
          result.toolCalls.map((call) => ({
            conversation_id: conversationId,
            message_id: saved?.id ?? null,
            organization_id: org.id,
            user_id: userId,
            tool_name: call.tool,
            arguments: call.arguments,
            result_summary: { summary: call.summary },
          })),
        );
      }

      await supabase.from("ai_usage").insert({
        organization_id: org.id,
        user_id: userId,
        conversation_id: conversationId,
        model: "analyst",
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        duration_ms: result.usage.durationMs,
        status: "ok",
      });

      return {
        conversationId,
        message: {
          id: (saved?.id as string) ?? crypto.randomUUID(),
          conversation_id: conversationId,
          role: "assistant",
          content: result.answer,
          evidence: result.evidence,
          tools_used: result.toolCalls,
          created_at: (saved?.created_at as string) ?? new Date().toISOString(),
        },
      };
    } catch (error) {
      await supabase.from("ai_usage").insert({
        organization_id: org.id,
        user_id: userId,
        conversation_id: conversationId,
        model: "analyst",
        duration_ms: Date.now() - started,
        status: "error",
      });
      if (error instanceof AnalystUnavailable) throw new Error(error.message);
      console.error("[analyst] failed", error);
      throw new Error(FRIENDLY_ERROR);
    }
  });

export const getExecutiveBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OrgInput & { period?: string | null }) => input)
  .handler(async ({ data, context }): Promise<ExecutiveBriefing> => {
    const org = await resolveOrg(context.supabase, data.organizationId);
    const { buildBriefing } = await import("./briefing.server");
    return buildBriefing({ supabase: context.supabase, orgId: org.id, org }, data.period ?? null);
  });
