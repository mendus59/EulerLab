/**
 * Markdown -> HTML with KaTeX math, ::: callout containers and ```solve blocks.
 */
import { Marked } from 'marked';
import katex from 'katex';

const CALLOUTS: Record<string, { label: string; collapsible?: boolean }> = {
  definition: { label: 'Definition' },
  theorem: { label: 'Theorem' },
  example: { label: 'Example' },
  note: { label: 'Note' },
  tip: { label: 'Tip' },
  warning: { label: 'Watch out' },
  exercise: { label: 'Exercise' },
  solution: { label: 'Solution', collapsible: true },
  proof: { label: 'Proof', collapsible: true },
  summary: { label: 'Summary' },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function renderTex(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', trust: false });
  } catch {
    return `<code>${escapeHtml(tex)}</code>`;
  }
}

/** Replace math with placeholders so Markdown doesn't mangle it. */
function protectMath(src: string, store: string[]): string {
  const put = (html: string) => {
    store.push(html);
    return `%%MATH${store.length - 1}%%`;
  };
  // fenced code blocks are left untouched
  const parts = src.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => put(`<div class="math-display">${renderTex(t.trim(), true)}</div>`))
        .replace(/\\\[([\s\S]+?)\\\]/g, (_, t) => put(`<div class="math-display">${renderTex(t.trim(), true)}</div>`))
        .replace(/\\\(([\s\S]+?)\\\)/g, (_, t) => put(renderTex(t.trim(), false)))
        .replace(/(^|[^\\$])\$(?!\s)((?:\\\$|[^$\n])+?)\$(?!\d)/g, (_, pre, t) => pre + put(renderTex(t, false)));
    })
    .join('');
}

function restoreMath(html: string, store: string[]): string {
  return html.replace(/%%MATH(\d+)%%/g, (_, i) => store[Number(i)]);
}

const marked = new Marked({ gfm: true, breaks: false });
marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === 'solve') {
        const eqs = text
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        return eqs
          .map(
            (eq) =>
              `<div class="solve-embed"><code>${escapeHtml(eq)}</code><button type="button" class="btn btn-small" data-solve="${escapeHtml(eq)}">Solve step by step →</button></div>`,
          )
          .join('');
      }
      return `<pre><code>${escapeHtml(text)}</code></pre>`;
    },
    html({ text }) {
      // Raw HTML in content is escaped, not rendered.
      return escapeHtml(text);
    },
  },
});

/** Split ":::type Title ... :::" containers (one level). */
function renderBlocks(src: string, store: string[]): string {
  const lines = src.split('\n');
  let out = '';
  let buf: string[] = [];
  let inBox: { type: string; title: string; lines: string[] } | null = null;
  let inFence = false;
  const flush = () => {
    if (buf.length) out += marked.parse(buf.join('\n')) as string;
    buf = [];
  };
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const open = !inFence && /^\s*:::\s*([A-Za-z]+)\s*(.*)$/.exec(line);
    const close = !inFence && /^\s*:::\s*$/.test(line);
    if (!inBox && open) {
      flush();
      inBox = { type: open[1].toLowerCase(), title: open[2].trim(), lines: [] };
      continue;
    }
    if (inBox && close) {
      out += renderCallout(inBox.type, inBox.title, inBox.lines.join('\n'));
      inBox = null;
      continue;
    }
    if (inBox) inBox.lines.push(line);
    else buf.push(line);
  }
  if (inBox) out += renderCallout(inBox.type, inBox.title, inBox.lines.join('\n'));
  flush();
  return out;
}

function renderCallout(type: string, title: string, body: string): string {
  const def = CALLOUTS[type] ?? { label: type.charAt(0).toUpperCase() + type.slice(1) };
  const inner = marked.parse(body) as string;
  const titleHtml = marked.parseInline(title) as string;
  const head = `<span class="callout-label">${def.label}</span>${title ? `<span class="callout-title">${titleHtml}</span>` : ''}`;
  if (def.collapsible) {
    return `<details class="callout callout-${type}"><summary class="callout-head">${head}</summary><div class="callout-body">${inner}</div></details>`;
  }
  return `<div class="callout callout-${type}"><div class="callout-head">${head}</div><div class="callout-body">${inner}</div></div>`;
}

export function renderMarkdown(src: string): string {
  const store: string[] = [];
  const protectedSrc = protectMath(src, store);
  const html = renderBlocks(protectedSrc, store);
  return restoreMath(html, store);
}

/** Inline text with $...$ math (used for solver step prose). */
export function renderInline(src: string): string {
  const store: string[] = [];
  const p = protectMath(src, store);
  return restoreMath(marked.parseInline(p) as string, store);
}
