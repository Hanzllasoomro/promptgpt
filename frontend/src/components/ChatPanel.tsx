import { useEffect, useRef, useState } from "react";
import { runChat, runChatStream } from "../api";
import {
  loadConversations,
  newConversation,
  newId,
  saveConversations,
  titleFor,
  transcriptMarkdown,
  type ChatMessage,
  type Conversation,
} from "../conversations";
import { getKey, getLastProvider, hasKey, setLastProvider } from "../keys";
import type { ProviderInfo } from "../types";
import Markdown from "./Markdown";

interface Props {
  providers: ProviderInfo[];
  initialPrompt: string;
  onNeedKey: () => void;
}

const SUGGESTED_PROMPTS = [
  "Explain quantum computing in simple terms",
  "Write a Python function that reverses a string",
  "Give me 5 tips for writing better prompts",
  "Summarise the pros and cons of remote work",
];

/** Opening provider: the last one used, else the first provider with a
 * saved key, else OpenAI. Previously this was always OpenAI, so a user
 * with only a Gemini key saved hit "No OpenAI key saved" on every Run. */
function pickInitialProvider(providers: ProviderInfo[]): string {
  const saved = getLastProvider();
  if (saved && providers.some((p) => p.id === saved)) return saved;
  const withKey = providers.find((p) => hasKey(p.id));
  if (withKey) return withKey.id;
  return "openai";
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

export default function ChatPanel({ providers, initialPrompt, onNeedKey }: Props) {
  const [initialConversations] = useState<Conversation[]>(() => {
    const loaded = loadConversations();
    return loaded.length > 0 ? loaded : [newConversation()];
  });
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(initialConversations[0].id);
  const [provider, setProvider] = useState(() => pickInitialProvider(providers));
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434/v1");
  const [input, setInput] = useState(initialPrompt);
  const [useLangChain, setUseLangChain] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [needsKey, setNeedsKey] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef<{ id: string; len: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);
  const userPickedProvider = useRef(false);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const messages: ChatMessage[] = active?.messages ?? [];
  const info = providers.find((p) => p.id === provider);
  const key = getKey(provider);
  const effectiveModel = model || info?.default_model || "";

  // Providers load after first render: apply the remembered / keyed
  // provider once they arrive, unless the user already chose one.
  useEffect(() => {
    if (userPickedProvider.current || providers.length === 0) return;
    const picked = pickInitialProvider(providers);
    if (picked !== provider) {
      setProvider(picked);
      setModel("");
    }
  }, [providers, provider]);

  // A prompt handed over from the Generate tab prefills the input.
  useEffect(() => {
    if (initialPrompt) setInput(initialPrompt);
  }, [initialPrompt]);

  // Conversations persist in the browser, like API keys.
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // Auto-grow the input, and keep the stream pinned to the bottom
  // while new content arrives (unless the user scrolled up to read).
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [input]);

  useEffect(() => {
    const el = streamRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streaming]);

  function chooseProvider(next: string) {
    userPickedProvider.current = true;
    setProvider(next);
    setLastProvider(next);
    setModel("");
  }

  function patchMessages(id: string, patch: (msgs: ChatMessage[]) => ChatMessage[]) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, messages: patch(c.messages) } : c)),
    );
  }

  function startNew() {
    const convo = newConversation();
    setConversations((prev) => [convo, ...prev]);
    setActiveId(convo.id);
    setError("");
    setNeedsKey(false);
    inputRef.current?.focus();
  }

  function deleteActive() {
    if (!active) return;
    const rest = conversations.filter((c) => c.id !== active.id);
    const next = rest.length > 0 ? rest : [newConversation()];
    setConversations(next);
    setActiveId(next[0].id);
    setError("");
  }

  function exportActive() {
    if (!active) return;
    const blob = new Blob([transcriptMarkdown(active)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promptgpt-chat-${active.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function setFeedback(id: string, fb: "up" | "down") {
    if (!active) return;
    patchMessages(active.id, (msgs) =>
      msgs.map((m) => (m.id === id ? { ...m, feedback: m.feedback === fb ? undefined : fb } : m)),
    );
  }

  /** Run one turn: `history` already ends with the latest user message.
   * Streams into a draft assistant message (or a single whole reply
   * for the LangChain path). A partial draft is kept when the run is
   * stopped or fails mid-stream; an empty draft is removed. */
  async function runTurn(history: ChatMessage[], promptText: string) {
    if (!active) return;
    const convoId = active.id;
    const payload = history.map(({ role, content }) => ({ role, content }));
    const body = { provider, model: effectiveModel, prompt: promptText, base_url: baseUrl, messages: payload };

    if (useLangChain) {
      setStreaming(true);
      try {
        const res = await runChat(body, key || "local", true);
        const reply: ChatMessage = {
          id: newId(),
          role: "assistant",
          content: res.reply,
          model: res.model,
          latencyMs: res.latency_ms,
        };
        patchMessages(convoId, (msgs) => [...msgs, reply]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chat failed");
      } finally {
        setStreaming(false);
      }
      return;
    }

    const draftId = newId();
    draftRef.current = { id: draftId, len: 0 };
    patchMessages(convoId, (msgs) => [...msgs, { id: draftId, role: "assistant", content: "" }]);
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    try {
      await runChatStream(body, key || "local", {
        onDelta: (text) => {
          if (draftRef.current) draftRef.current.len += text.length;
          patchMessages(convoId, (msgs) =>
            msgs.map((m) => (m.id === draftId ? { ...m, content: m.content + text } : m)),
          );
        },
        onDone: (latencyMs, usedModel) => {
          const used = usedModel || effectiveModel;
          patchMessages(convoId, (msgs) =>
            msgs.map((m) =>
              m.id === draftId
                ? {
                    ...m,
                    model: used,
                    latencyMs,
                    fallbackFrom: usedModel && usedModel !== effectiveModel ? effectiveModel : undefined,
                  }
                : m,
            ),
          );
        },
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // Stopped: the partial reply stays on screen; not an error.
      } else {
        setError(e instanceof Error ? e.message : "Chat failed");
      }
    } finally {
      if (draftRef.current && draftRef.current.len === 0) {
        patchMessages(convoId, (msgs) => msgs.filter((m) => m.id !== draftId));
      }
      draftRef.current = null;
      abortRef.current = null;
      setStreaming(false);
    }
  }

  async function send(text: string) {
    const promptText = text.trim();
    if (!promptText || streaming || !active) return;
    if (!key && provider !== "openai-compatible") {
      // Stay on this tab so the error stays visible: previously this
      // switched to the Keys tab, which unmounted this panel and
      // discarded the error before the user could read it.
      setError(`No ${info?.name} key saved. Add it in the Keys tab first.`);
      setNeedsKey(true);
      return;
    }
    setError("");
    setNeedsKey(false);
    setInput("");
    const userMsg: ChatMessage = { id: newId(), role: "user", content: promptText };
    const history = [...messages, userMsg];
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? {
              ...c,
              title: c.messages.length === 0 ? titleFor(promptText) : c.title,
              messages: history,
            }
          : c,
      ),
    );
    await runTurn(history, promptText);
  }

  async function regenerate() {
    if (streaming || !active) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const idx = messages.findIndex((m) => m.id === lastUser.id);
    const history = messages.slice(0, idx + 1);
    patchMessages(active.id, () => history);
    setError("");
    setNeedsKey(false);
    await runTurn(history, lastUser.content);
  }

  function cancel() {
    abortRef.current?.abort();
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <section className="panel chat-panel">
      <div className="chat-shell">
        <aside className="chat-history" aria-label="Conversations">
          <button className="btn-primary chat-new" onClick={startNew} disabled={streaming}>
            + New chat
          </button>
          <ul>
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  className={c.id === active?.id ? "active" : ""}
                  onClick={() => setActiveId(c.id)}
                  title={c.title}
                >
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="chat-main">
          <header className="chat-header">
            <h2>Chat</h2>
            <span className="model-badge" title="Active model">
              {info?.name ?? provider} · {effectiveModel || "…"}
            </span>
            <div className="row chat-header-actions">
              <button className="btn-secondary btn-small" onClick={exportActive} disabled={!active || messages.length === 0}>
                Export
              </button>
              <button className="btn-secondary btn-small" onClick={deleteActive} disabled={!active || streaming}>
                Delete
              </button>
            </div>
          </header>

          <div className="grid chat-controls">
            <label>
              Provider
              <select value={provider} onChange={(e) => chooseProvider(e.target.value)} disabled={streaming}>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label>
              Model
              <input
                value={model}
                placeholder={info?.default_model}
                onChange={(e) => setModel(e.target.value)}
                list="models"
                disabled={streaming}
              />
              <datalist id="models">
                {(info?.models || []).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
          </div>
          {info?.supports_base_url && (
            <label>
              Base URL (OpenAI-compatible server)
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} disabled={streaming} />
            </label>
          )}

          <div className="chat-stream" ref={streamRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="chat-empty">
                <p className="muted">
                  Ask anything — the conversation is kept in this browser, and
                  follow-ups remember what came before. Your key is sent only
                  with each request.
                </p>
                <div className="suggest-pills">
                  {SUGGESTED_PROMPTS.map((s) => (
                    <button key={s} className="pill" onClick={() => void send(s)} disabled={streaming}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="msg msg-user">
                  <div className="msg-bubble">{m.content}</div>
                  <div className="msg-actions">
                    <button onClick={() => void copyText(m.content)}>Copy</button>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="msg msg-assistant">
                  <Markdown text={m.content} streaming={streaming && m.id === draftRef.current?.id} />
                  {m.content && (
                    <div>
                      {(m.model || m.latencyMs) && (
                        <p className="small mono tabular msg-meta">
                          {m.model}
                          {m.latencyMs ? `, ${m.latencyMs} ms` : ""}
                          {m.fallbackFrom ? ` — fell back from ${m.fallbackFrom}` : ""}
                        </p>
                      )}
                      <div className="msg-actions">
                        <button onClick={() => void copyText(m.content)}>Copy</button>
                        {m.id === lastAssistant?.id && !streaming && (
                          <button onClick={() => void regenerate()}>Regenerate</button>
                        )}
                        <button
                          className={m.feedback === "up" ? "active" : ""}
                          onClick={() => setFeedback(m.id, "up")}
                          aria-label="Good response"
                        >
                          👍
                        </button>
                        <button
                          className={m.feedback === "down" ? "active" : ""}
                          onClick={() => setFeedback(m.id, "down")}
                          aria-label="Bad response"
                        >
                          👎
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ),
            )}
            {error && (
              <div className="chat-error" role="alert">
                <p>{error}</p>
                <div className="row">
                  {needsKey ? (
                    <button className="btn-secondary btn-small" onClick={onNeedKey}>
                      Go to Keys
                    </button>
                  ) : (
                    <button className="btn-secondary btn-small" onClick={() => void regenerate()} disabled={streaming}>
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="composer chat-inputbar">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKeyDown}
              rows={1}
              placeholder="Message PromptGPT… (Enter to send, Shift + Enter for a new line)"
              disabled={streaming}
              aria-label="Message"
            />
            <div className="composer-foot">
              <label className="check" style={{ marginTop: 0 }}>
                <input
                  type="checkbox"
                  checked={useLangChain}
                  onChange={(e) => setUseLangChain(e.target.checked)}
                  disabled={streaming}
                />
                <span className="small">Run via LangChain (reply arrives whole, not streamed)</span>
              </label>
              <div className="row" style={{ marginTop: 0 }}>
                {streaming && !useLangChain ? (
                  <button className="btn-secondary" onClick={cancel}>Stop</button>
                ) : streaming ? (
                  <button className="btn-primary" disabled>Running…</button>
                ) : (
                  <button className="btn-primary" onClick={() => void send(input)} disabled={!input.trim()}>
                    Send
                  </button>
                )}
              </div>
            </div>
          </div>
          {!key && <p className="muted">No key saved for {info?.name} — add one in Keys.</p>}
        </div>
      </div>
    </section>
  );
}
