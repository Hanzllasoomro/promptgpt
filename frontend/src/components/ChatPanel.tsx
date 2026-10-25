import { useState } from "react";
import { runChat } from "../api";
import { getKey } from "../keys";
import type { ProviderInfo } from "../types";

interface Props {
  providers: ProviderInfo[];
  initialPrompt: string;
  onNeedKey: () => void;
}

export default function ChatPanel({ providers, initialPrompt, onNeedKey }: Props) {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434/v1");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [useLangChain, setUseLangChain] = useState(false);
  const [reply, setReply] = useState("");
  const [meta, setMeta] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const info = providers.find((p) => p.id === provider);
  const key = getKey(provider);
  const effectiveModel = model || info?.default_model || "";

  async function run() {
    setLoading(true);
    setError("");
    setReply("");
    try {
      if (!key && provider !== "openai-compatible") {
        onNeedKey();
        throw new Error(`No ${info?.name} key saved. Add it in the Keys tab first.`);
      }
      const res = await runChat(
        { provider, model: effectiveModel, prompt, base_url: baseUrl },
        key || "local",
        useLangChain,
      );
      setReply(res.reply);
      setMeta(`${res.provider} · ${res.model} · via ${res.via} · ${res.latency_ms} ms`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Run a prompt directly with your own LLM key</h2>
      <p className="muted">
        Pick a provider, paste (or generate) a prompt, and run it here — no need to
        leave PromptGPT. Your key is sent only with this request.
      </p>
      <div className="grid">
        <label>
          Provider
          <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(""); }}>
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
      <label>
        Prompt
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} />
      </label>
      <label className="check">
        <input type="checkbox" checked={useLangChain} onChange={(e) => setUseLangChain(e.target.checked)} />
        Run via LangChain instead of the direct provider API (requires the optional
        LangChain packages on the backend)
      </label>
      <div className="row">
        <button onClick={run} disabled={loading || !prompt.trim()}>
          {loading ? "Running…" : "Run with my key"}
        </button>
        {!key && <span className="muted">No key saved for {info?.name} — add one in Keys.</span>}
      </div>
      {error && <p className="error">{error}</p>}
      {reply && (
        <div>
          <p className="muted">{meta}</p>
          <pre className="prompt-text">{reply}</pre>
        </div>
      )}
    </section>
  );
}
