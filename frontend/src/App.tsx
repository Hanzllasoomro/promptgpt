import { useEffect, useState } from "react";
import { generatePrompt, listProviders } from "./api";
import ChatPanel from "./components/ChatPanel";
import KeysPanel from "./components/KeysPanel";
import PromptResult from "./components/PromptResult";
import type { GenerateResponse, HistoryItem, ProviderInfo } from "./types";

const TASK_TYPES = ["general", "write", "code", "explain", "marketing", "learn", "plan"];

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem("promptgpt:history") || "[]") as HistoryItem[];
  } catch {
    return [];
  }
}

export default function App() {
  const [tab, setTab] = useState<"generate" | "chat" | "keys" | "history">("generate");
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
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);

  useEffect(() => {
    listProviders().then((d) => setProviders(d.providers)).catch(() => {});
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

  return (
    <div className="shell">
      <header>
        <h1>✨ PromptGPT</h1>
        <p>Turn a casual idea into an engineered prompt — then send it to your chatbot, or run it here with your own key.</p>
        <nav>
          {(["generate", "chat", "keys", "history"] as const).map((t) => (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {t === "generate" ? "Generate" : t === "chat" ? "Chat with my key" : t === "keys" ? "Keys" : "History"}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === "generate" && (
          <>
            <section className="card">
              <label>
                Your casual idea
                <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4}
                  placeholder="e.g. Explain quantum physics to a 5-year-old using emojis…" />
              </label>
              <div className="grid">
                <label>Task type
                  <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                    {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label>Audience
                  <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. high-school students" />
                </label>
                <label>Tone
                  <input value={tone} onChange={(e) => setTone(e.target.value)} />
                </label>
                <label>Length
                  <select value={length} onChange={(e) => setLength(e.target.value)}>
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </label>
              </div>
              <label>Output format
                <input value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)} />
              </label>
              <label>Context (optional — what is this for?)
                <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={2} />
              </label>
              <button onClick={generate} disabled={loading || idea.trim().length < 3}>
                {loading ? "Engineering…" : "Engineer my prompt"}
              </button>
              {error && <p className="error">{error}</p>}
              <p className="muted">No API key needed for this step — prompt engineering here is deterministic and runs offline.</p>
            </section>
            {result && <PromptResult result={result} onUseInChat={(p) => { setChatPrompt(p); setTab("chat"); }} />}
          </>
        )}

        {tab === "chat" && (
          <ChatPanel providers={providers} initialPrompt={chatPrompt} onNeedKey={() => setTab("keys")} />
        )}

        {tab === "keys" && <KeysPanel providers={providers} />}

        {tab === "history" && (
          <section className="card">
            <h2>History (this browser only)</h2>
            {history.length === 0 && <p className="muted">Nothing yet — generate a prompt first.</p>}
            {history.map((h) => (
              <details key={h.id}>
                <summary>{h.idea}</summary>
                <pre className="prompt-text">{h.engineered_prompt}</pre>
                <button onClick={() => { setChatPrompt(h.engineered_prompt); setTab("chat"); }}>Run this in Chat →</button>
              </details>
            ))}
            {history.length > 0 && (
              <button className="danger" onClick={() => { setHistory([]); localStorage.removeItem("promptgpt:history"); }}>
                Clear history
              </button>
            )}
          </section>
        )}
      </main>
      <footer className="muted">
        PromptGPT v2 — backend and frontend deploy independently. Your keys never leave your browser except as a header on your own chat request.
      </footer>
    </div>
  );
}
