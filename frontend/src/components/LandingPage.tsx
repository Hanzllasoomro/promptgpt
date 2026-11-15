import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { generatePrompt } from "../api";
import type { GenerateResponse } from "../types";
import "../landing.css";

const TASK_TYPES = ["general", "write", "code", "explain", "marketing", "learn", "plan"];

const EXAMPLE_IDEAS = [
  "Explain quantum physics to a 5-year-old using simple analogies",
  "A modern personal portfolio website for a creative designer",
  "A week-long meal plan for a busy family of four",
];

// Real output from PromptGPT's engine for the first example idea,
// shortened for display — the wording is the engine's own.
const AFTER_EXAMPLE = `## Role
Act as a patient teacher who explains hard ideas with simple analogies.

## Objective
Explain quantum physics to a 5-year-old using simple analogies

## Steps
1. Start with a simple analogy, then add detail gradually.
2. Use a concrete example for every abstract idea.
3. End with a one-paragraph recap and a self-check question.`;

const PROVIDERS = ["OpenAI", "Anthropic", "Google", "Hugging Face", "OpenAI-compatible"];

const FEATURES: { title: string; text: string }[] = [
  {
    title: "Seven task types",
    text: "General, write, code, explain, marketing, learn, plan — each one shapes the structure of the prompt around what you are actually asking for.",
  },
  {
    title: "Chat with your own key",
    text: "Bring a key for OpenAI, Anthropic, Google, Hugging Face or any OpenAI-compatible endpoint and chat in the app, with streaming replies in markdown.",
  },
  {
    title: "Reply length & creativity",
    text: "Choose 512 to 4096 tokens and a creativity of 0.2, 0.7 or 1.0 per chat. The app remembers your settings in your browser.",
  },
  {
    title: "Keys stay in your browser",
    text: "Keys live in localStorage and are sent only as a header on your own chat request. They are never stored or logged server-side.",
  },
  {
    title: "Multi-turn memory",
    text: "Conversations persist in the sidebar and the model sees the last 20 messages, so follow-ups stay in context.",
  },
  {
    title: "History on your device",
    text: "Your last 50 engineered prompts, newest first. Nothing about them leaves your device.",
  },
];

const STEPS: { n: string; title: string; text: string }[] = [
  {
    n: "01",
    title: "Write the idea in plain words",
    text: "No prompt jargon. One or two sentences, the way you would say it to a colleague.",
  },
  {
    n: "02",
    title: "PromptGPT structures it",
    text: "Role, objective, context, steps, constraints and output format — plus accuracy rules that stop invented facts and bracketed placeholders.",
  },
  {
    n: "03",
    title: "Copy it or run it here",
    text: "Send the engineered prompt to any chatbot, or run it in Chat with your own key.",
  },
];

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`lp-reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  const [idea, setIdea] = useState("");
  const [taskType, setTaskType] = useState("general");
  const [demo, setDemo] = useState<GenerateResponse | null>(null);
  const [demoError, setDemoError] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem("promptgpt:history") || "[]") as unknown[];
      setHistoryCount(Array.isArray(h) ? h.length : 0);
    } catch {
      setHistoryCount(0);
    }
  }, []);

  function onHeroMouseMove(e: MouseEvent<HTMLElement>) {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  async function runDemo() {
    if (idea.trim().length < 3 || demoLoading) return;
    setDemoLoading(true);
    setDemoError("");
    setDemo(null);
    try {
      const res = await generatePrompt({
        idea,
        task_type: taskType,
        audience: "",
        tone: "clear and helpful",
        output_format: "structured answer with headings",
        length: "medium",
        context: "",
      });
      setDemo(res);
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "The live demo could not reach the API.");
    } finally {
      setDemoLoading(false);
    }
  }

  async function copyDemo() {
    if (!demo) return;
    const ok = await copyText(demo.engineered_prompt);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="landing">
      <header className="lp-nav">
        <a className="lp-wordmark" href="#top">
          PromptGPT<span className="wordmark-accent">.</span>
        </a>
        <nav className="lp-nav-links" aria-label="Sections">
          <a href="#demo">Try it</a>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
        </nav>
        <button className="btn-primary lp-nav-cta" type="button" onClick={onLaunch}>
          Open app
        </button>
      </header>

      <main id="top">
        <section className="lp-hero" ref={heroRef} onMouseMove={onHeroMouseMove}>
          <div className="lp-aurora" aria-hidden="true" />
          <div className="lp-spotlight" aria-hidden="true" />
          <div className="lp-hero-copy reveal">
            <p className="lp-eyebrow">Prompt engineering, minus the guesswork</p>
            <h1>
              Turn a casual idea into an <span className="lp-grad">engineered prompt</span>.
            </h1>
            <p className="lp-sub">
              Type an idea in plain words. PromptGPT structures it — role, objective, context,
              steps, constraints, output format — so the model gives you a better answer the
              first time.
            </p>
            <div className="row lp-cta-row">
              <button className="btn-primary lp-cta-primary" type="button" onClick={onLaunch}>
                Start engineering — it&rsquo;s free
              </button>
              <a className="btn-secondary lp-cta-secondary" href="#demo">
                Try the live demo ↓
              </a>
            </div>
            {historyCount > 0 && (
              <p className="lp-welcome">
                Welcome back — you&rsquo;ve engineered {historyCount} prompt{historyCount === 1 ? "" : "s"} here.{" "}
                <button className="lp-link" type="button" onClick={onLaunch}>
                  Jump back in →
                </button>
              </p>
            )}
            <p className="lp-trust">
              Free · No account · No key needed to engineer · Your keys never leave your browser
            </p>
          </div>
          <div className="lp-hero-visual reveal-2">
            <img
              className="lp-hero-img"
              src="/hero.webp"
              alt="A messy scatter of terracotta and charcoal fragments becoming a neat stack of ruled, structured pages"
              width={1536}
              height={1024}
              onError={(e) => {
                // The artwork ships as frontend/public/hero.webp; if it is
                // missing the frame falls back to its gradient.
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="lp-float-card" aria-hidden="true">
              <p className="lp-float-label">Engineered prompt</p>
              <p className="lp-float-line">
                <strong>Role</strong> — Act as a patient teacher…
              </p>
              <p className="lp-float-line">
                <strong>Steps</strong> — Start with a simple analogy…
              </p>
              <span className="md-cursor" />
            </div>
          </div>
        </section>

        <Reveal className="lp-section" >
          <section className="lp-demo" id="demo">
            <div className="lp-section-head">
              <h2>Try it right here</h2>
              <p>
                No account, no key — the engine is deterministic and runs on the live API.
                Type an idea, pick a task type, and watch it become a structured prompt.
              </p>
            </div>
            <div className="lp-demo-grid">
              <div className="panel lp-demo-form">
                <label>
                  Your idea
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    rows={4}
                    placeholder="e.g. Explain quantum physics to a 5-year-old using simple analogies"
                  />
                </label>
                <label>
                  Task type
                  <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="row">
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={runDemo}
                    disabled={demoLoading || idea.trim().length < 3}
                  >
                    {demoLoading ? "Engineering…" : "Engineer my prompt"}
                  </button>
                </div>
                <div className="lp-chips" aria-label="Example ideas">
                  {EXAMPLE_IDEAS.map((ex) => (
                    <button
                      key={ex}
                      className="pill"
                      type="button"
                      onClick={() => setIdea(ex)}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                {demoError && <p className="error">{demoError}</p>}
              </div>
              <div className="lp-demo-result">
                {demo ? (
                  <div className="panel">
                    <div className="panel-head">
                      <h3>Your engineered prompt</h3>
                      <button className="btn-secondary btn-small" type="button" onClick={copyDemo}>
                        {copied ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                    <pre className="document">{demo.engineered_prompt}</pre>
                    {demo.tips.length > 0 && (
                      <ul className="tips">
                        {demo.tips.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    )}
                    <div className="row">
                      <button className="btn-primary" type="button" onClick={onLaunch}>
                        Open this in the app →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="panel empty-state">
                    <h3>Your engineered prompt will appear here</h3>
                    <p>
                      The live demo calls the same deterministic engine as the app — no key,
                      no account. If the API is unreachable, the before-and-after below shows
                      a real example instead.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal className="lp-section">
          <section className="lp-before-after" id="example">
            <div className="lp-section-head">
              <h2>Before / after</h2>
              <p>One casual sentence in, a structured prompt out. Real output from the engine, shortened for display.</p>
            </div>
            <div className="lp-ba-grid">
              <div className="panel lp-ba-before">
                <p className="lp-ba-label">Casual idea</p>
                <p className="mono lp-ba-idea">
                  &ldquo;Explain quantum physics to a 5-year-old using simple analogies&rdquo;
                </p>
              </div>
              <div className="panel lp-ba-after">
                <p className="lp-ba-label">Engineered prompt</p>
                <pre className="document lp-ba-doc">{AFTER_EXAMPLE}</pre>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal className="lp-section">
          <section className="lp-providers">
            <div className="lp-section-head">
              <h2>Chat with the models you already use</h2>
              <p>
                Bring your own key and chat in the app. Keys are stored only in your browser
                and sent as a header on your own chat request.
              </p>
            </div>
            <ul className="lp-provider-chips">
              {PROVIDERS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        </Reveal>

        <Reveal className="lp-section">
          <section className="lp-features" id="features">
            <div className="lp-section-head">
              <h2>Everything the app does, in one place</h2>
            </div>
            <div className="lp-features-grid">
              {FEATURES.map((f) => (
                <article className="panel lp-feature" key={f.title}>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal className="lp-section">
          <section className="lp-how" id="how">
            <div className="lp-section-head">
              <h2>How it works</h2>
            </div>
            <ol className="lp-steps">
              {STEPS.map((s) => (
                <li className="panel lp-step" key={s.n}>
                  <p className="lp-step-n">{s.n}</p>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        <Reveal className="lp-section">
          <section className="lp-cta">
            <h2>Your next prompt is one sentence away.</h2>
            <p>Free, no account, and it runs in your browser.</p>
            <button className="btn-primary lp-cta-primary" type="button" onClick={onLaunch}>
              Open PromptGPT →
            </button>
          </section>
        </Reveal>
      </main>

      <footer className="lp-footer">
        <p className="lp-wordmark">
          PromptGPT<span className="wordmark-accent">.</span>
        </p>
        <p>
          Open source —{" "}
          <a href="https://github.com/Hanzllasoomro/promptgpt" target="_blank" rel="noreferrer">
            github.com/Hanzllasoomro/promptgpt
          </a>
        </p>
        <p className="muted">Built with FastAPI and React. Your keys never leave your browser.</p>
      </footer>
    </div>
  );
}
