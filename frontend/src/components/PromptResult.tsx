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
    <section className="card">
      <div className="card-head">
        <h2>Engineered prompt</h2>
        <div className="row">
          <button onClick={() => copy(result.engineered_prompt)}>{copied ? "Copied!" : "Copy prompt"}</button>
          <button className="secondary" onClick={() => onUseInChat(result.engineered_prompt)}>
            Run it here with my key →
          </button>
        </div>
      </div>
      <pre className="prompt-text">{result.engineered_prompt}</pre>
      <details>
        <summary>Concise version</summary>
        <p>{result.concise_prompt}</p>
      </details>
      <ul className="tips">
        {result.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <div className="send-section">
        <h3>Send to your favourite chatbot</h3>
        {!chatbots && (
          <button onClick={loadChatbots}>Show chatbot options</button>
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
        <p className="muted">
          Prefilled links work where the chatbot accepts a prompt in the URL. For the rest,
          PromptGPT copies the prompt first — you paste once after the chat opens.
        </p>
      </div>
    </section>
  );
}
