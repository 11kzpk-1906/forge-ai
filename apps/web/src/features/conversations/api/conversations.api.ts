import { supabase } from "../../../lib/supabase";
import { getApiBaseUrl } from "../../../lib/api-url";
import type { ChatMessage } from "../../chat/api/chat.api";

export interface Conversation {
  id: string;
  title: string;
  mode: string;
  personality: string;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredMessage extends ChatMessage {
  id: string;
  conversation_id: string;
  model: string | null;
  mode: string | null;
  personality: string | null;
  created_at: string;
}

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You must be signed in to use ForgeAI.");
  }

  return fetch(getApiBaseUrl() + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + session.access_token,
      ...(init?.headers ?? {}),
    },
  });
}

export async function listConversations(): Promise<Conversation[]> {
  const response = await authorizedFetch("/api/v1/conversations");
  if (!response.ok) throw new Error("Could not load your conversations.");
  const payload = await response.json();
  return payload.conversations ?? [];
}

export async function getConversationMessages(conversationId: string): Promise<StoredMessage[]> {
  const response = await authorizedFetch("/api/v1/conversations/" + encodeURIComponent(conversationId) + "/messages");
  if (!response.ok) throw new Error("Could not load this conversation.");
  const payload = await response.json();
  return payload.messages ?? [];
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await authorizedFetch(
    "/api/v1/conversations/" + encodeURIComponent(conversationId),
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error("Could not delete this conversation.");
}
