/** Shared, browser-safe types for the AI Business Analyst (Phase 4). */

export type Confidence = "known" | "inferred" | "unknown";

export type AiEvidence = {
  label: string;
  value: string;
  detail?: string;
  period?: string;
  confidence: Confidence;
};

export type AiToolCallRecord = {
  tool: string;
  arguments: Record<string, unknown>;
  summary: string;
};

export type AiMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  evidence: AiEvidence[];
  tools_used: AiToolCallRecord[];
  created_at: string;
};

export type AiConversation = {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
};

export type AskResult = {
  conversationId: string;
  message: AiMessage;
};

export type BriefingSection = {
  heading: string;
  points: string[];
};

export type ExecutiveBriefing = {
  summary: string;
  sections: BriefingSection[];
  evidence: AiEvidence[];
  generatedAt: string;
};

export const SUGGESTED_QUESTIONS = [
  "How is my business performing?",
  "What changed this month?",
  "What are my top products?",
  "Who are my best customers?",
  "Why did revenue change?",
  "What should I focus on?",
  "Show me my biggest business risks.",
  "Compare this month with last month.",
];
