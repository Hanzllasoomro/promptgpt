import { useEffect, useState } from "react";
import { evaluatePrompt } from "../api";
import type { EvaluateResponse, HistoryItem } from "../types";

function loadLastGenerated(): string {
  try {
    const h = JSON.parse(localStorage.getItem("promptgpt:history") || "[]") as HistoryItem[];
    return h.length > 0 ? h[0].engineered_prompt : "";
  } catch {
    return "";
  }
}

function reportMarkdown(prompt: string, result: EvaluateResponse): string {
  const lines = [
    `# Prompt evaluation — ${result.overall}/10`,
    "",
    `Verdict: ${result.verdict}`,
    "",
    ...result.dimensions.flatMap((d) => [
      `## ${d.name} — ${d.score}/10`,
      ...d.findings.map((f) => `- ${f}`),
      ...(d.suggestion ? [`Fix: ${d.suggestion}`] : []),
      "",
    ]),
    "---",
    "",
    prompt,
  ];
  return lines.join("\n");
}

export default function EvaluatePanel({ initialPrompt }: { initialPrompt: string }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [result, setResult] = useState<EvaluateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // "Evaluate this prompt" from a Generate result arrives as a new
  // initial prompt; keep the textarea in sync with it.
  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);

  async function score() {
    if (prompt.trim().length < 1 || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await evaluatePrompt(prompt));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyReport() {
    if (!result) return;
    await navigator.clipboard.writeText(reportMarkdown(prompt, result));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="work-grid">
      <section className="panel">
        <h2>Prompt to score</h2>
        <label>
          Paste any prompt — yours, or one you were sent
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            placeholder="Paste a prompt here…"
          />
        </label>
        <div className="row">
          <button className="btn-primary" type="button" onClick={score} disabled={loading || prompt.trim().length < 1}>
            {loading ? "Scoring…" : "Score this prompt"}
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => setPrompt(loadLastGenerated())}
          >
            Use my last generated prompt
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <p className="muted">
          Scored on CLEAR — Concise, Logical, Explicit, Adaptive, Reflective. Deterministic:
          the same prompt always gets the same score, and every deduction says why.
        </p>
      </section>

      {result ? (
        <section className="panel">
          <div className="panel-head">
            <h2>
              {result.overall}
              <span className="muted"> / 10</span>
            </h2>
            <button className="btn-secondary btn-small" type="button" onClick={copyReport}>
              {copied ? "Copied ✓" : "Copy report"}
            </button>
          </div>
          <p>
            <strong>{result.verdict}</strong>
          </p>
          {result.dimensions.map((d) => (
            <div key={d.id} className="eval-dim">
              <div className="eval-dim-head">
                <strong>{d.name}</strong>
                <span className="tabular">
                  {d.score} / 10
                </span>
              </div>
              <div className="eval-bar" role="img" aria-label={`${d.name}: ${d.score} out of 10`}>
                <div
                  className={`eval-bar-fill${d.score >= 8 ? " eval-bar-good" : d.score >= 6 ? " eval-bar-ok" : " eval-bar-weak"}`}
                  style={{ width: `${d.score * 10}%` }}
                />
              </div>
              <ul className="tips">
                {d.findings.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {d.suggestion && (
                <p className="eval-fix">
                  <strong>Fix:</strong> {d.suggestion}
                </p>
              )}
            </div>
          ))}
        </section>
      ) : (
        <section className="panel empty-state">
          <h2>Your CLEAR breakdown will appear here</h2>
          <p>
            Each dimension is scored out of 10 with the exact reasons behind it — no black box.
            A prompt the engine produced should score 7.5 or higher; a bare one-liner scores under 5.
          </p>
        </section>
      )}
    </div>
  );
}
