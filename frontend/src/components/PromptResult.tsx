import { useState } from "react";
import { listChatbots } from "../api";
import type { ChatbotInfo, GenerateResponse } from "../types";

interface Props {
  result: GenerateResponse;
  onUseInChat: (prompt: string) => void;
}

export default function PromptResult({ result, onUseInChat }: Props) {
  const [copied, setCopied] = useState(false);
  const [chatbots, setChatbots] = useState<ChatbotInfo[] | null>(null);
  const [chatbotError, setChatbotError] = useState("");

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function loadChatbots() {
    try {
      const data = await listChatbots(result.engineered_prompt);
      setChatbots(data.chatbots);
    } catch (e) {
      setChatbotError(e instanceof Error ? e.message : "Could not load chatbot links");
    }
  }

  async function sendTo(bot: ChatbotInfo) {
    if (!bot.prefilled) await navigator.clipboard.writeText(result.engineered_prompt);
    window.open(bot.url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Engineered prompt</h2>
        <div className="row" style={{ marginTop: 0 }}>
          <button id="copy-prompt" className="btn-secondary" onClick={() => copy(result.engineered_prompt)}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
          <button id="use-in-chat" className="btn-primary" onClick={() => onUseInChat(result.engineered_prompt)}>
            Run with my key
          </button>
        </div>
      </div>
      <pre className="document">{result.engineered_prompt}</pre>
      <details>
        <summary>Concise version</summary>
        <p className="muted" style={{ marginTop: "var(--space-2)", lineHeight: "1.7" }}>{result.concise_prompt}</p>
      </details>
      <ul className="tips">
        {result.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <div style={{ marginTop: "var(--space-4)" }}>
        <h3>Send to a chatbot</h3>
        {!chatbots && (
          <button id="show-chatbots" className="btn-secondary" onClick={loadChatbots} style={{ marginTop: "var(--space-2)" }}>
            Show chatbot options
          </button>
        )}
        {chatbotError && <p className="error">{chatbotError}</p>}
        {chatbots && (
          <div className="chatbot-grid">
            {chatbots.map((bot) => (
              <button key={bot.id} className="chatbot" onClick={() => sendTo(bot)} title={bot.note}>
                {bot.name}
                <small>{bot.prefilled ? "Prefilled" : "Copy, then paste"}</small>
              </button>
            ))}
          </div>
        )}
        <p className="muted" style={{ fontSize: "var(--text-small)" }}>
          Prefilled links pass the prompt via URL. For others, the prompt is copied to your clipboard first.
        </p>
      </div>
    </section>
  );
}
