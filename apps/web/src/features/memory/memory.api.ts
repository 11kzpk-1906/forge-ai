import { supabase } from "../../../lib/supabase";
import { getApiBaseUrl } from "../../../lib/api-url";

export interface MemoryItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source_conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MemoryListResponse {
  memories: MemoryItem[];
}

interface MemoryResponse {
  memory: MemoryItem;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in to manage your memories.");

  const response = await fetch(getApiBaseUrl() + "/api/v1/memory" + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + session.access_token,
    },
  });

  if (!response.ok) {
    let message = "Memory request failed.";
    try {
      const payload: unknown = await response.json();
      if (typeof payload === "object" && payload !== null && "detail" in payload) {
        const detail = payload.detail;
        if (typeof detail === "string") {
          message = detail;
        } else if (Array.isArray(detail)) {
          const messages = detail
            .map((item: unknown) => {
              if (typeof item === "string") return item;
              if (typeof item === "object" && item !== null && "msg" in item && typeof item.msg === "string") {
                return item.msg;
              }
              return null;
            })
            .filter((item): item is string => Boolean(item));
          if (messages.length > 0) message = messages.join(" ");
        }
      }
    } catch {
      // Keep a useful fallback when the API doesn't return JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function listMemories(query = ""): Promise<MemoryItem[]> {
  const params = new URLSearchParams();
  if (query.trim().length >= 2) params.set("query", query.trim());
  const encoded = params.toString();
  const suffix = encoded ? "?" + encoded : "";
  const payload = await request<MemoryListResponse>(suffix);
  return Array.isArray(payload.memories) ? payload.memories : [];
}

export async function createMemory(input: { title: string; content: string; tags: string[] }): Promise<MemoryItem> {
  const payload = await request<MemoryResponse>("", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.memory;
}

export async function updateMemory(id: string, input: { title: string; content: string; tags: string[] }): Promise<MemoryItem> {
  const payload = await request<MemoryResponse>("/" + encodeURIComponent(id), {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return payload.memory;
}

export async function deleteMemory(id: string): Promise<void> {
  await request<{ deleted: boolean }>("/" + encodeURIComponent(id), { method: "DELETE" });
}
