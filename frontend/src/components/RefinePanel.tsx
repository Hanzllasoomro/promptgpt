import { useState } from "react";
import { refinePrompt } from "../api";
import { getKey, getLastProvider, hasKey, setLastProvider } from "../keys";
import type { ProviderInfo, RefineResponse } from "../types";

const TASK_TYPES = [
  { id: "general", label: "General" },
  { id: "write", label: "Write" },
  { id: "code", label: "Code" },
  { id: "explain", label: "Explain" },
  { id: "marketing", label: "Marketing" },
  { id: "learn", label: "Learn" },
  { id: "plan", label: "Plan" },
];

interface Props {
  providers: ProviderInfo[];
  onNeedKey: () => void;
  onUseInChat: (prompt: string) => void;
}

export default function RefinePanel({ providers, onNeedKey, onUseInChat }: Props) {
  const [idea, setIdea] = useState("");
  const [taskType, setTaskType] = useState("general");
  const [provider, setProvider] = useState(() => getLastProvider() || providers[0]?.id || "openai");
  const [rounds, setRounds] = useState(3);
  const [result, setResult] = useState<RefineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const providerInfo = providers.find((p) => p.id === provider) ?? providers[0];
  const keyReady = providerInfo ? hasKey(providerInfo.id) : false;

  function pickProvider(id: string) {
    setProvider(id);
    setLastProvider(id);
  }

  async function run() {
    if (!idea.trim() || loading || !providerInfo) return;
    if (!keyReady) {
      onNeedKey();
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await refinePrompt(
        { idea: idea.trim(), task_type: taskType, provider: providerInfo.id, model: providerInfo.default_model, rounds },
        getKey(providerInfo.id),
      );
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refine failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyBest() {
    if (!result) return;
    await navigator.clipboard.writeText(result.best_prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="work-grid">
      <section className="panel">
        <h2>What should the prompt do?</h2>
        <label>
          Your idea, in plain words
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} placeholder="e.g. Explain quantum physics to a 5-year-old using simple analogies" />
        </label>
        <div className="form-row">
          <label>
            Task type
            <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
              {TASK_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rounds
            <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "round" : "rounds"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Provider (your key, from the Keys tab)
          <select value={provider} onChange={(e) => pickProvider(e.target.value)}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.default_model}
              </option>
            ))}
          </select>
        </label>
        {!keyReady && providerInfo && (
          <p className="error">
            No key saved for {providerInfo.name}.{" "}
            <button className="btn-secondary btn-small" type="button" onClick={onNeedKey}>
              Add it in the Keys tab
            </button>
          </p>
        )}
        <div className="row">
          <button className="btn-primary" type="button" onClick={run} disabled={loading || idea.trim().length < 3 || !keyReady}>
            {loading ? "Refining — one model call per round…" : "Refine this prompt"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <p className="muted">
          Round 0 is the engine's starting prompt. Each round after that, the CLEAR evaluator scores the
          current version and the model rewrites the weakest parts. The best-scoring version wins — even
          if a later round scores worse. {rounds} {rounds === 1 ? "round" : "rounds"} = {rounds} model call{rounds === 1 ? "" : "s"}.
        </p>
      </section>

      {result ? (
        <section className="panel">
          <h2>
            Best: {result.best_overall} / 10{" "}
            <span className="muted">
              (from {result.base_overall}, {result.improved_by > 0 ? `+${result.improved_by}` : "no gain"})
            </span>
          </h2>
          {result.note && <p className="error">{result.note}</p>}
          <div className="row" style={{ marginTop: 0 }}>
            <button className="btn-secondary" type="button" onClick={copyBest}>
              {copied ? "Copied ✓" : "Copy best prompt"}
            </button>
            <button className="btn-primary" type="button" onClick={() => onUseInChat(result.best_prompt)}>
              Run it with my key
            </button>
          </div>
          <pre className="document">{result.best_prompt}</pre>
          <h3>Rounds</h3>
          {result.rounds.map((r) => (
            <details key={r.round} className="refine-round">
              <summary>
                Round {r.round} — {r.overall} / 10
                {r.improved ? " · improved" : r.round === 0 ? " · starting prompt" : " · no gain"}
              </summary>
              <p className="muted">{r.note}</p>
              <div className="eval-bar" role="img" aria-label={`Round ${r.round}: ${r.overall} out of 10`}>
                <div
                  className={`eval-bar-fill${r.overall >= 8 ? " eval-bar-good" : r.overall >= 6 ? " eval-bar-ok" : " eval-bar-weak"}`}
                  style={{ width: `${r.overall * 10}%` }}
                />
              </div>
              <pre className="document">{r.prompt}</pre>
            </details>
          ))}
        </section>
      ) : (
        <section className="panel empty-state">
          <h2>Your refined prompt will appear here</h2>
          <p>
            The loop is honest about what it does: it scores, rewrites, and keeps the best. If a round
            makes the prompt worse, it is discarded — you never lose a good version to a bad rewrite.
          </p>
        </section>
      )}
    </div>
  );
}
