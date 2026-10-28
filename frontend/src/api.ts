import type { ChatbotInfo, GenerateResponse, ProviderInfo } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* keep statusText */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function generatePrompt(body: Record<string, unknown>): Promise<GenerateResponse> {
  return request<GenerateResponse>("/api/prompts/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function listProviders(): Promise<{ providers: ProviderInfo[] }> {
  return request("/api/providers");
}

export function listChatbots(prompt: string): Promise<{ chatbots: ChatbotInfo[] }> {
  return request(`/api/chatbots?prompt=${encodeURIComponent(prompt)}`);
}

export interface ChatResult {
  provider: string;
  model: string;
  reply: string;
  via: string;
  latency_ms: number;
}

export function runChat(
  body: Record<string, unknown>,
  apiKey: string | undefined,
  useLangChain: boolean,
): Promise<ChatResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-LLM-API-Key"] = apiKey;
  return request<ChatResult>(useLangChain ? "/api/chat/run-langchain" : "/api/chat/run", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function runChatStream(
  body: Record<string, unknown>,
  apiKey: string,
  callbacks: {
    onDelta: (text: string) => void;
    onDone: (latencyMs: number) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-LLM-API-Key"] = apiKey;
  const res = await fetch("/api/chat/run-stream", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: callbacks.signal,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const parsed = await res.json();
      detail = parsed.detail || JSON.stringify(parsed);
    } catch {
      /* keep statusText */
    }
    throw new Error(detail);
  }
  if (!res.body) throw new Error("Streaming is not supported by this browser");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of block.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim());
          if (event.type === "delta" && event.text) callbacks.onDelta(event.text);
          if (event.type === "error") throw new Error(event.detail || "Streaming failed");
          if (event.type === "done") {
            callbacks.onDone(event.latency_ms || 0);
            return;
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function checkKey(provider: string, apiKey: string): Promise<{ format_ok: boolean; stored: boolean }> {
  return request("/api/keys/check?provider=" + encodeURIComponent(provider), {
    method: "POST",
    headers: { "X-LLM-API-Key": apiKey },
  });
}
