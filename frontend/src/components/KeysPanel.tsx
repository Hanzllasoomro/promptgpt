import { useEffect, useState } from "react";
import { checkKey } from "../api";
import { clearAllKeys, getKey, masked, setKey } from "../keys";
import type { ProviderInfo } from "../types";

interface Props {
  providers: ProviderInfo[];
}

export default function KeysPanel({ providers }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setValues((prev) => {
      const next = { ...prev };
      for (const p of providers) {
        if (!(p.id in next)) next[p.id] = getKey(p.id);
      }
      return next;
    });
  }, [providers]);

  function save(provider: string) {
    setKey(provider, values[provider] || "");
    setSaved(provider);
    setNotice("");
    setTimeout(() => setSaved(""), 2000);
  }

  async function check(provider: string) {
    try {
      const res = await checkKey(provider, values[provider] || "");
      setNotice(
        res.format_ok
          ? "Format looks valid. A real provider call in the Chat tab is the true test."
          : "That does not look like a usable key yet.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Check failed");
    }
  }

  return (
    <section className="panel">
      <h2>API keys — bring your own</h2>
      <p className="muted">
        Keys are stored <strong>only in this browser</strong> via localStorage. They are
        forwarded once to the provider on a chat request — never stored or logged server-side.
        There is no PromptGPT account.
      </p>
      {providers.map((p) => (
        <div key={p.id} className="setting-row">
          <div className="setting-label">
            <h3>{p.name}</h3>
            <p>{p.key_help}</p>
            <p className="small">Saved: <span className="mono">{masked(getKey(p.id))}</span></p>
          </div>
          <div className="setting-field">
            <label>
              API key
              <input
                id={`key-${p.id}`}
                type="password"
                autoComplete="off"
                placeholder="Paste your key here"
                value={values[p.id] || ""}
                onChange={(e) => setValues({ ...values, [p.id]: e.target.value })}
              />
            </label>
            <div className="row">
              <button id={`save-${p.id}`} className="btn-primary" onClick={() => save(p.id)}>
                {saved === p.id ? "✓ Saved" : "Save in browser"}
              </button>
              <button id={`check-${p.id}`} className="btn-secondary" onClick={() => check(p.id)}>
                Check format
              </button>
            </div>
          </div>
        </div>
      ))}
      {notice && <p style={{ marginTop: "var(--space-3)" }}>{notice}</p>}
      <button
        id="clear-all-keys"
        className="btn-danger"
        onClick={() => {
          clearAllKeys();
          setValues(Object.fromEntries(providers.map((p) => [p.id, ""])));
        }}
      >
        Clear all keys
      </button>
    </section>
  );
}
