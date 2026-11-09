/** Chat conversations, stored in the browser like API keys: nothing
 * leaves the machine, and deleting them is one click. A conversation
 * is a list of messages; the whole list is sent to the backend on
 * every Run, so follow-ups have context. */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Model that actually answered (may differ after a fallback). */
  model?: string;
  latencyMs?: number;
  /** The requested model, when a fallback answered instead. */
  fallbackFrom?: string;
  /** Local-only feedback; never sent anywhere. */
  feedback?: "up" | "down";
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}

const KEY = "promptgpt:chats";
const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES = 100;

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function titleFor(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 48 ? `${oneLine.slice(0, 48)}…` : oneLine || "New chat";
}

export function newConversation(firstPrompt = ""): Conversation {
  return {
    id: newId(),
    title: firstPrompt ? titleFor(firstPrompt) : "New chat",
    createdAt: Date.now(),
    messages: [],
  };
}

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (c): c is Conversation =>
          !!c && typeof c === "object" &&
          typeof (c as Conversation).id === "string" &&
          Array.isArray((c as Conversation).messages),
      )
      .map((c) => ({ ...c, messages: c.messages.slice(-MAX_MESSAGES) }))
      .slice(0, MAX_CONVERSATIONS);
  } catch {
    return [];
  }
}

export function saveConversations(list: Conversation[]): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(list.slice(0, MAX_CONVERSATIONS)),
    );
  } catch {
    /* storage full or unavailable: chat still works in memory */
  }
}

/** Transcript as Markdown, for the Export button. */
export function transcriptMarkdown(c: Conversation): string {
  const lines = [`# ${c.title}`, ""];
  for (const m of c.messages) {
    lines.push(m.role === "user" ? "## You" : "## Assistant");
    lines.push("");
    lines.push(m.content);
    lines.push("");
    if (m.role === "assistant" && (m.model || m.latencyMs)) {
      const meta = [m.model, m.latencyMs ? `${m.latencyMs} ms` : ""]
        .filter(Boolean)
        .join(", ");
      lines.push(`*${meta}*`);
      lines.push("");
    }
  }
  return lines.join("\n");
}
