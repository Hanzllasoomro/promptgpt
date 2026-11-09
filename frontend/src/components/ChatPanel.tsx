import { useEffect, useRef, useState } from "react";
import { runChat, runChatStream } from "../api";
import { getKey, getLastProvider, hasKey, setLastProvider } from "../keys";
import Markdown from "./Markdown";
import type { ProviderInfo } from "../types";

interface Props {
  providers: ProviderInfo[];
  initialPrompt: string;
  onNeedKey: () => void;
}

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

export default function ChatPanel({ providers, initialPrompt, onNeedKey }: Props) {
  const [provider, setProvider] = useState(() => pickInitialProvider(providers));
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434/v1");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [useLangChain, setUseLangChain] = useState(false);
  const [reply, setReply] = useState("");
  const [meta, setMeta] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsKey, setNeedsKey] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const userPickedProvider = useRef(false);

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

  const info = providers.find((p) => p.id === provider);
  const key = getKey(provider);
  const effectiveModel = model || info?.default_model || "";

  function chooseProvider(next: string) {
    userPickedProvider.current = true;
    setProvider(next);
    setLastProvider(next);
    setModel("");
  }

  async function run() {
    setLoading(true);
    setError("");
    setNeedsKey(false);
    setReply("");
    try {
      if (!key && provider !== "openai-compatible") {
        // Stay on this tab so the error stays visible: previously this
        // switched to the Keys tab, which unmounted this panel and
        // discarded the error before the user could read it.
        setError(`No ${info?.name} key saved. Add it in the Keys tab first.`);
        setNeedsKey(true);
        return;
      }
      if (useLangChain) {
        // LangChain has no streaming path: the whole reply arrives at once.
        const res = await runChat(
          { provider, model: effectiveModel, prompt, base_url: baseUrl },
          key || "local",
          true,
        );
        setReply(res.reply);
        setMeta(`${res.provider}, ${res.model}, via ${res.via}, ${res.latency_ms} ms`);
      } else {
        const controller = new AbortController();
        abortRef.current = controller;
        await runChatStream(
          { provider, model: effectiveModel, prompt, base_url: baseUrl },
          key || "local",
          {
            onDelta: (text) => setReply((prev) => prev + text),
            onDone: (latencyMs, model) => {
              const used = model || effectiveModel;
              const fallbackNote =
                model && model !== effectiveModel ? ` — fell back from ${effectiveModel}` : "";
              setMeta(`${provider}, ${used}, via httpx-stream, ${latencyMs} ms${fallbackNote}`);
            },
            signal: controller.signal,
          },
        );
      }
    } catch (e) {
      // Cancelling keeps the partial reply on screen; it is not an error.
      if (e instanceof DOMException && e.name === "AbortError") {
        setMeta((prev) => prev || "Stopped — partial reply kept.");
      } else {
        setError(e instanceof Error ? e.message : "Chat failed");
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  return (
    <section className="panel">
      <h2>Chat</h2>
      <p className="muted">
        Pick a provider, paste or generate a prompt, and run it here — no need to
        leave PromptGPT. Your key is sent only with this request.
      </p>
      <div className="grid">
        <label>
          Provider
          <select value={provider} onChange={(e) => chooseProvider(e.target.value)}>
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
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </label>
      )}
      <div className="composer" style={{ marginTop: "1rem" }}>
        <label>
          Prompt
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} placeholder="Paste or generate a prompt, then run it below" />
        </label>
        <div className="composer-foot">
          <label className="check" style={{ marginTop: 0 }}>
            <input type="checkbox" checked={useLangChain} onChange={(e) => setUseLangChain(e.target.checked)} />
            <span className="small">Run via LangChain (requires the optional LangChain packages on the backend; reply arrives whole, not streamed)</span>
          </label>
          <div className="row" style={{ marginTop: 0 }}>
            {loading && !useLangChain && (
              <button className="btn-secondary" onClick={cancel}>Stop</button>
            )}
            <button className="btn-primary" onClick={run} disabled={loading || !prompt.trim()}>
              {loading ? (useLangChain ? "Running…" : "Streaming…") : "Run"}
            </button>
          </div>
        </div>
      </div>
      {!key && <p className="muted">No key saved for {info?.name} — add one in Keys.</p>}
      {error && (
        <div>
          <p className="error">{error}</p>
          {needsKey && (
            <div className="row">
              <button className="btn-secondary" onClick={onNeedKey}>Go to Keys</button>
            </div>
          )}
        </div>
      )}
      {reply && (
        <div>
          <p className="small mono tabular">{meta}</p>
          <Markdown text={reply} />
        </div>
      )}
    </section>
  );
}
