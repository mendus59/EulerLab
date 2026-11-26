export type FrontValue = string | number | boolean | string[];

/** Minimal YAML front matter parser (key: value, [a, b] lists, quoted strings). */
export function parseFrontMatter(src: string): { data: Record<string, FrontValue>; body: string } {
  const text = src.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { data: {}, body: text };
  const data: Record<string, FrontValue> = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    data[kv[1]] = parseValue(kv[2].trim());
  }
  return { data, body: text.slice(m[0].length) };
}

function parseValue(v: string): FrontValue {
  if (/^\[.*\]$/.test(v)) {
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => unquote(s.trim()))
      .filter(Boolean);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  // Keep section numbers like 1.10 as strings; only plain integers become numbers.
  if (/^-?\d+$/.test(v)) return Number(v);
  return unquote(v);
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}
