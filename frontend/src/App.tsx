import { useEffect, useState } from "react";
import { generatePrompt, listProviders } from "./api";
import ChatPanel from "./components/ChatPanel";
import KeysPanel from "./components/KeysPanel";
import PromptResult from "./components/PromptResult";
import { hasKey } from "./keys";
import type { GenerateResponse, HistoryItem, ProviderInfo } from "./types";

const TASK_TYPES = ["general", "write", "code", "explain", "marketing", "learn", "plan"];

const TABS = [
  { id: "generate", label: "Generate" },
  { id: "chat", label: "Chat" },
  { id: "keys", label: "Keys" },
  { id: "history", label: "History" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const PAGE_HEADS: Record<Tab, { title: string; text: string }> = {
  generate: {
    title: "Make a better prompt",
    text: "Write an idea in plain words. PromptGPT turns it into a structured prompt you can send or run.",
  },
  chat: {
    title: "Run it with your key",
    text: "Choose a provider and run the prompt here, using only your own API key.",
  },
  keys: {
    title: "Your keys, your browser",
    text: "Add a key per provider once. It stays in this browser and is sent only with a chat request.",
  },
  history: {
    title: "Past prompts",
    text: "Every prompt you generated here, newest first. Nothing here leaves your device.",
  },
};

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem("promptgpt:history") || "[]") as HistoryItem[];
  } catch {
    return [];
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>("generate");
  const [idea, setIdea] = useState("");
  const [taskType, setTaskType] = useState("general");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("clear and helpful");
  const [outputFormat, setOutputFormat] = useState("structured answer with headings");
  const [length, setLength] = useState("medium");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [chatPrompt, setChatPrompt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [apiDown, setApiDown] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);

  useEffect(() => {
    listProviders()
      .then((d) => setProviders(d.providers))
      .catch(() => setApiDown(true));
  }, []);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await generatePrompt({
        idea, task_type: taskType, audience, tone, output_format: outputFormat, length, context,
      });
      setResult(res);
      const item: HistoryItem = {
        id: String(Date.now()),
        createdAt: new Date().toISOString(),
        idea: res.original_idea,
        engineered_prompt: res.engineered_prompt,
      };
      const next = [item, ...history].slice(0, 50);
      setHistory(next);
      localStorage.setItem("promptgpt:history", JSON.stringify(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  const keysSaved = providers.filter((p) => hasKey(p.id)).length;
  const head = PAGE_HEADS[tab];

  return (
    <div className="app">
      <aside className="sidebar">
        <p className="wordmark">PromptGPT<span className="wordmark-accent">.</span></p>
        <nav className="nav" aria-label="Main">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p>
            <strong>API:</strong> {apiDown ? "unavailable — is the backend running?" : providers.length ? "connected" : "checking"}
          </p>
          {providers.length > 0 && (
            <p>
              <strong>Keys saved:</strong> <span className="tabular">{keysSaved} of {providers.length}</span> providers
            </p>
          )}
          <p>Keys never leave your browser except as a header on your own chat request.</p>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <div className="page-head reveal">
            <h1>{head.title}</h1>
            <p>{head.text}</p>
          </div>

          {tab === "generate" && (
            <div className="work-grid reveal-2">
              <section className="panel">
                <h2>Your idea</h2>
                <label>
                  Casual idea
                  <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4}
                    placeholder="e.g. Explain quantum physics to a 5-year-old using simple analogies" />
                </label>
                <div className="grid">
                  <label>Task type
                    <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                      {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label>Length
                    <select value={length} onChange={(e) => setLength(e.target.value)}>
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                    </select>
                  </label>
                </div>
                <label>Audience
                  <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. high-school students" />
                </label>
                <label>Tone
                  <input value={tone} onChange={(e) => setTone(e.target.value)} />
                </label>
                <label>Output format
                  <input value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)} />
                </label>
                <label>Context (optional — what is this for?)
                  <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={2} />
                </label>
                <div className="row">
                  <button className="btn-primary" onClick={generate} disabled={loading || idea.trim().length < 3}>
                    {loading ? "Engineering…" : "Engineer my prompt"}
                  </button>
                </div>
                {error && <p className="error">{error}</p>}
                <p className="muted">No API key needed here — prompt engineering is deterministic and runs offline.</p>
              </section>

              {result ? (
                <PromptResult result={result} onUseInChat={(p) => { setChatPrompt(p); setTab("chat"); }} />
              ) : (
                <section className="panel empty-state">
                  <h2>Your engineered prompt will appear here</h2>
                  <ol>
                    <li>Write the idea in plain words on the left.</li>
                    <li>PromptGPT structures it: role, objective, context, steps, constraints, output format.</li>
                    <li>Copy it, send it to your favourite chatbot, or run it here with your own key.</li>
                  </ol>
                  <p>Try: “A modern personal portfolio website for a creative designer” or “Explain quantum physics to a 5-year-old using simple analogies”.</p>
                </section>
              )}
            </div>
          )}

          {tab === "chat" && (
            <div className="reveal-2">
              <ChatPanel providers={providers} initialPrompt={chatPrompt} onNeedKey={() => setTab("keys")} />
            </div>
          )}

          {tab === "keys" && (
            <div className="reveal-2">
              <KeysPanel providers={providers} />
            </div>
          )}

          {tab === "history" && (
            <section className="panel reveal-2">
              <h2>Past prompts</h2>
              {history.length === 0 && <p className="muted">Nothing yet — generate a prompt first.</p>}
              {history.map((h) => (
                <details key={h.id}>
                  <summary>{h.idea}</summary>
                  <pre className="document">{h.engineered_prompt}</pre>
                  <div className="row">
                    <button className="btn-secondary" onClick={() => { setChatPrompt(h.engineered_prompt); setTab("chat"); }}>Run this in Chat</button>
                  </div>
                </details>
              ))}
              {history.length > 0 && (
                <button className="btn-danger" onClick={() => { setHistory([]); localStorage.removeItem("promptgpt:history"); }}>
                  Clear history
                </button>
              )}
            </section>
          )}

          <footer className="sheet-foot">
            PromptGPT — engineered prompts, your keys, your browser.
          </footer>
        </div>
      </main>
    </div>
  );
}
