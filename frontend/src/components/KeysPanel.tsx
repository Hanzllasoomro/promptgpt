import { useState } from "react";
import { checkKey } from "../api";
import { clearAllKeys, getKey, masked, setKey } from "../keys";
import type { ProviderInfo } from "../types";

interface Props {
  providers: ProviderInfo[];
}

export default function KeysPanel({ providers }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(providers.map((p) => [p.id, getKey(p.id)])),
  );
  const [saved, setSaved] = useState("");
  const [notice, setNotice] = useState("");

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
          ? "Format looks OK. A real provider call (in the Chat tab) is the true validity test."
          : "That does not look like a usable key yet.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Check failed");
    }
  }

  return (
    <section className="card">
      <h2>Your API keys — bring your own</h2>
      <p className="muted">
        Keys are stored <strong>only in this browser</strong> (localStorage). They are sent
        to your backend as a header on a chat request, forwarded once to the provider,
        and never stored or logged server-side. There is no PromptGPT account and no
        key ever touches our servers beyond that single forward.
      </p>
      {providers.map((p) => (
        <div key={p.id} className="key-row">
          <label>
            <strong>{p.name}</strong>
            <span className="muted"> — {p.key_help}</span>
            <input
              type="password"
              autoComplete="off"
              placeholder={masked(getKey(p.id))}
              value={values[p.id] || ""}
              onChange={(e) => setValues({ ...values, [p.id]: e.target.value })}
            />
          </label>
          <div className="row">
            <button onClick={() => save(p.id)}>{saved === p.id ? "Saved!" : "Save in this browser"}</button>
            <button className="secondary" onClick={() => check(p.id)}>Check format</button>
          </div>
        </div>
      ))}
      {notice && <p>{notice}</p>}
      <button
        className="danger"
        onClick={() => {
          clearAllKeys();
          setValues(Object.fromEntries(providers.map((p) => [p.id, ""])));
        }}
      >
        Clear all keys from this browser
      </button>
    </section>
  );
}
