import { useState, type ReactElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** Render a chat reply as markdown: headings, lists, tables, links and
 * fenced code blocks with a copy button. Raw HTML in the model output is
 * never rendered (no rehype-raw), so a reply cannot inject markup.
 *
 * Streaming caveat: while chunks are still arriving the markdown may be
 * incomplete (e.g. an unclosed fence renders as a code block until the
 * closing fence arrives); react-markdown re-parses on every render, so
 * the view settles as soon as the stream finishes.
 */

function codeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(codeText).join("");
  if (typeof node === "object" && "props" in node) {
    return codeText((node as ReactElement).props.children);
  }
  return "";
}

function CodeBlock({ language, text }: { language: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API needs a secure context; fall back to a selection.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="md-codeblock">
      <div className="md-codeblock-head">
        <span>{language || "code"}</span>
        <button type="button" className="md-copy" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code className={language ? `language-${language}` : undefined}>{text}</code>
      </pre>
    </div>
  );
}

const components: Components = {
  // Block code is rendered here, by reading the <code> element's
  // language and text directly; the `code` override below therefore
  // only ever sees inline code.
  pre({ children }) {
    const child = Array.isArray(children) ? children[0] : children;
    if (child && typeof child === "object" && "props" in child) {
      const props = (child as ReactElement).props as {
        className?: string;
        children?: ReactNode;
      };
      const match = /language-([\w-]+)/.exec(props.className || "");
      return <CodeBlock language={match?.[1] || ""} text={codeText(props.children)} />;
    }
    return <pre>{children}</pre>;
  },
  code({ children }) {
    return <code className="md-inline-code">{children}</code>;
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="md-table-wrap">
        <table>{children}</table>
      </div>
    );
  },
};

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="reply">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
