import { useEffect, useState } from "react";
import { listLibrary } from "../api";
import type { LibraryTemplate } from "../types";

export default function LibraryPanel({ onUseTemplate }: { onUseTemplate: (t: LibraryTemplate) => void }) {
  const [templates, setTemplates] = useState<LibraryTemplate[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    listLibrary()
      .then((data) => {
        if (alive) setTemplates(data.templates);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Could not load the library");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!templates) return <p className="muted">Loading templates…</p>;

  return (
    <div className="library-grid">
      {templates.map((t) => (
        <article key={t.id} className="panel library-card">
          <p className="library-domain">{t.domain}</p>
          <h3>{t.title}</h3>
          <p>{t.description}</p>
          <p className="muted">
            Try it: <em>{t.example_idea}</em>
          </p>
          <button className="btn-primary btn-small" type="button" onClick={() => onUseTemplate(t)}>
            Use this template
          </button>
        </article>
      ))}
    </div>
  );
}
