import { supabase } from "../../../lib/supabase";
import { getApiBaseUrl } from "../../../lib/api-url";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ConversationCreatedPayload {
  id: string;
  title: string;
  mode: string;
  personality: string;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface StreamOptions {
  messages: ChatMessage[];
  mode: string;
  personality: string;
  conversationId?: string | null;
  onToken: (token: string) => void;
  onConversationCreated?: (conversation: ConversationCreatedPayload) => void;
  onConversationTitle?: (conversationId: string, title: string) => void;
  onDone: (conversationId?: string) => void;
  onError: (message: string) => void;
}

type StreamEvent =
  | { type: "conversation"; conversation: ConversationCreatedPayload }
  | { type: "conversation_title"; conversation_id: string; title: string }
  | { type: "token"; content: string }
  | { type: "done"; conversation_id?: string }
  | { type: "error"; message?: string };

export async function streamChat({
  messages,
  mode,
  personality,
  conversationId,
  onToken,
  onConversationCreated,
  onConversationTitle,
  onDone,
  onError,
}: StreamOptions): Promise<void> {
  let completed = false;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You must be signed in to use ForgeAI.");
    }

    const response = await fetch(getApiBaseUrl() + "/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.access_token,
      },
      body: JSON.stringify({
        messages,
        mode,
        personality,
        conversation_id: conversationId ?? null,
      }),
    });

    if (!response.ok) {
      let message = "Chat request failed.";
      try {
        const payload: unknown = await response.json();
        if (
          typeof payload === "object" &&
          payload !== null &&
          "detail" in payload &&
          typeof payload.detail === "string"
        ) {
          message = payload.detail;
        }
      } catch {
        // A non-JSON error response is still handled with a safe fallback.
      }
      throw new Error(message);
    }

    if (!response.body) {
      throw new Error("Streaming is not supported by this response.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const dispatchEvent = (event: string): boolean => {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");

      if (!data.trim()) return false;

      let payload: StreamEvent;
      try {
        payload = JSON.parse(data) as StreamEvent;
      } catch {
        throw new Error("ForgeAI returned an invalid streaming response.");
      }

      if (payload.type === "conversation") {
        onConversationCreated?.(payload.conversation);
      } else if (payload.type === "conversation_title") {
        onConversationTitle?.(payload.conversation_id, payload.title);
      } else if (payload.type === "token") {
        if (typeof payload.content === "string") onToken(payload.content);
      } else if (payload.type === "done") {
        completed = true;
        onDone(payload.conversation_id);
        return true;
      } else if (payload.type === "error") {
        completed = true;
        onError(
          typeof payload.message === "string" && payload.message
            ? payload.message
            : "The chat request failed.",
        );
        return true;
      }

      return false;
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      let shouldStop = false;
      for (const event of events) {
        if (dispatchEvent(event)) {
          shouldStop = true;
          break;
        }
      }

      if (shouldStop) {
        await reader.cancel().catch(() => undefined);
        return;
      }
    }

    buffer += decoder.decode();
    if (!completed && buffer.trim()) dispatchEvent(buffer);

    if (!completed) {
      onError("The connection ended before ForgeAI finished responding. Please try again.");
    }
  } catch (error) {
    if (!completed) {
      onError(error instanceof Error ? error.message : "Something went wrong.");
    }
  }
}
