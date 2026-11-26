/**
 * Symbolic operations backed by nerdamer. All functions take and return
 * expression strings in a common notation understood by both nerdamer and
 * math.js (explicit `*`, `^`, `log` = natural log).
 */
import nerdamer from 'nerdamer';
import { math, parse, str, numEqual, symbols, samplePoints, evalAt, rationalize } from './math';
import type { Node } from './math';

type N = { toString(): string };

function nd(s: string): N {
  return nerdamer(s) as unknown as N;
}

/** Normalise through nerdamer (light canonical simplification). */
export function norm(s: string): string {
  try {
    return cleanup(nd(s).toString());
  } catch {
    return s;
  }
}

function cleanup(s: string): string {
  return s.replace(/\s+/g, '');
}

export function expand(s: string): string {
  try {
    return cleanup((nerdamer as unknown as { expand(s: string): N }).expand(s).toString());
  } catch {
    return norm(s);
  }
}

/** Distribute a product over a single sum factor: e^(-2x)*(a + b) -> a e^(-2x) + b e^(-2x). */
export function distribute(s: string): string {
  try {
    const n = unparen(parse(norm(s))) as Node & { [k: string]: any };
    const factors: { node: Node; inv: boolean }[] = [];
    const walk = (m: Node, inv: boolean) => {
      const q = unparen(m) as Node & { [k: string]: any };
      if (q.type === 'OperatorNode' && q.fn === 'multiply') {
        walk(q.args[0], inv);
        walk(q.args[1], inv);
      } else if (q.type === 'OperatorNode' && q.fn === 'divide') {
        walk(q.args[0], inv);
        walk(q.args[1], !inv);
      } else factors.push({ node: q, inv });
    };
    walk(n, false);
    const sums = factors.filter((f) => !f.inv && sumTerms(f.node).length > 1);
    if (sums.length !== 1) return s;
    const others = factors.filter((f) => f !== sums[0]).map((f) => (f.inv ? `(${str(f.node)})^(-1)` : `(${str(f.node)})`));
    const mult = others.length ? others.join('*') : '1';
    const terms = sumTerms(sums[0].node).map((t) => `${t.sign < 0 ? '-' : '+'}(${norm(`(${str(t.node)})*${mult}`)})`);
    return norm(terms.join(''));
  } catch {
    return s;
  }
}

export function diff(s: string, v: string): string {
  return cleanup((nerdamer as unknown as { diff(s: string, v: string): N }).diff(s, v).toString());
}

/** [integrand(a), antiderivative(a)] for trig forms nerdamer integrates awkwardly. */
const TABLE: [(a: string) => string, (a: string) => string][] = [
  [(a) => `tan(${a})`, (a) => `-log(cos(${a}))`],
  [(a) => `cot(${a})`, (a) => `log(sin(${a}))`],
  [(a) => `sec(${a})`, (a) => `log(sec(${a})+tan(${a}))`],
  [(a) => `csc(${a})`, (a) => `-log(csc(${a})+cot(${a}))`],
  [(a) => `sec(${a})^2`, (a) => `tan(${a})`],
  [(a) => `csc(${a})^2`, (a) => `-cot(${a})`],
  [(a) => `sec(${a})*tan(${a})`, (a) => `sec(${a})`],
  [(a) => `csc(${a})*cot(${a})`, (a) => `-csc(${a})`],
];

function trigArgs(s: string): string[] {
  const out = new Set<string>();
  try {
    parse(s).traverse((n) => {
      const f = n as Node & { [k: string]: any };
      if (f.type === 'FunctionNode' && ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'].includes(f.fn.name)) out.add(str(f.args[0]));
    });
  } catch {
    /* ignore */
  }
  return [...out];
}

/** Recognise k * (table integrand) numerically. */
function tableIntegral(s: string, v: string): string | null {
  const vars = [...symbols(s)].filter((x) => x !== 'e' && x !== 'pi');
  if (!vars.includes(v)) return null;
  for (const a of trigArgs(s)) {
    let ap: string;
    try {
      ap = norm(diff(a, v));
    } catch {
      continue;
    }
    if (symbols(ap).size) continue;
    for (const [tpl, anti] of TABLE) {
      const ratio = `(${s})/(${tpl(a)})`;
      const pts = samplePoints({ vars, count: 8, lo: 0.2, hi: 1.2, seed: 11 });
      let k: number | null = null;
      let ok = true;
      let valid = 0;
      for (const p of pts) {
        const r = evalAt(ratio, p);
        if (Number.isNaN(r)) continue;
        valid++;
        if (k === null) k = r;
        else if (Math.abs(r - k) > 1e-8 * (1 + Math.abs(k))) {
          ok = false;
          break;
        }
      }
      if (!ok || k === null || valid < 4) continue;
      const kr = rationalize(k, 1000, 1e-9);
      if (!kr) continue;
      return `(${kr[0]}/${kr[1]})/(${ap})*(${anti(a)})`;
    }
  }
  return null;
}

function nerdIntegrate(s: string, v: string): string | null {
  try {
    const r = cleanup((nerdamer as unknown as { integrate(s: string, v: string): N }).integrate(s, v).toString());
    if (/integrate\(/.test(r)) return null;
    const d = diff(r, v);
    const vars = [...new Set([...symbols(s), ...symbols(r)])].filter((x) => x !== 'e' && x !== 'pi');
    if (!numEqual(d, s, vars.length ? vars : [v])) return null;
    return r;
  } catch {
    return null;
  }
}

function ugly(r: string | null): boolean {
  return !r || r.length > 90 || /tan\(\(1\/2\)/.test(r);
}

function termwise(s: string, v: string): string | null {
  const terms = splitSum(expand(s));
  if (terms.length < 2) return null;
  const parts: string[] = [];
  for (const t of terms) {
    const r = tableIntegral(t, v) ?? nerdIntegrate(t, v);
    if (!r) return null;
    parts.push(`(${r})`);
  }
  return norm(parts.join('+'));
}

function splitSum(s: string): string[] {
  const terms: string[] = [];
  try {
    for (const t of sumTerms(parse(s))) terms.push(t.sign < 0 ? `-(${str(t.node)})` : str(t.node));
  } catch {
    return [s];
  }
  return terms;
}

function trigToSinCos(s: string): string {
  const t = s.replace(/\bsec\(/g, '1/cos(').replace(/\bcsc\(/g, '1/sin(').replace(/\btan\(/g, 'TAN(').replace(/\bcot\(/g, 'COT(');
  return norm(expandTanCot(t));
}

/** Antiderivative, or null if none could be found. */
export function integrate(s: string, v: string): string | null {
  const tab = tableIntegral(s, v);
  if (tab) return norm(tab);
  const r = nerdIntegrate(s, v);
  if (!ugly(r)) return r;
  const cands: string[] = r ? [r] : [];
  const tw = termwise(s, v);
  if (tw) cands.push(tw);
  if (/\b(sin|cos|tan|sec|csc|cot)\(/.test(s)) {
    const sc = trigToSinCos(s).replace(/sin\(([^()]*)\)\^2/g, '(1-cos($1)^2)');
    const tw2 = termwise(sc, v) ?? nerdIntegrate(sc, v);
    if (tw2) cands.push(tw2);
  }
  if (!cands.length) return null;
  return cands.sort((a, b) => a.length - b.length)[0];
}

export function sub(s: string, v: string, val: string): string {
  try {
    return cleanup((nerdamer(s) as unknown as { sub(a: string, b: string): N }).sub(v, `(${val})`).toString());
  } catch {
    return s;
  }
}

/** Substitute several values at once using math.js tree substitution, then normalise. */
export function subs(s: string, map: Record<string, string>): string {
  const node = parse(s).transform((n) => {
    if (n.type === 'SymbolNode') {
      const name = (n as unknown as { name: string }).name;
      if (name in map) return new math.ParenthesisNode(parse(map[name]));
    }
    return n;
  });
  return norm(str(node));
}

export function factor(s: string): string {
  try {
    return cleanup((nerdamer as unknown as { factor(s: string): N }).factor(s).toString());
  } catch {
    return s;
  }
}

/** Solve expr = 0 (or "a=b") for v. Returns real-looking solutions only. */
export function solve(eq: string, v: string): string[] {
  try {
    const r = (nerdamer as unknown as { solve(e: string, v: string): N }).solve(eq, v).toString();
    const inner = r.trim().replace(/^[{[]/, '').replace(/[}\]]$/, '');
    if (!inner) return [];
    return splitTopLevel(inner, ',').map((x) => cleanup(x)).filter((x) => x.length > 0);
  } catch {
    return [];
  }
}

export function solveSystem(eqs: string[], vars: string[]): Record<string, string> | null {
  try {
    const r = (nerdamer as unknown as { solveSystem(e: string[], v: string[]): N }).solveSystem(eqs, vars).toString();
    const out: Record<string, string> = {};
    const re = /([A-Za-z_]\w*)\s*=>\s*([^,}\]]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(r))) out[m[1]] = cleanup(m[2]);
    return vars.every((v) => v in out) ? out : null;
  } catch {
    return null;
  }
}

export function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------
// Simplification

/** Rewrite e^(a + k*log(u)) -> u^k * e^a and log(e^u) -> u. */
export function expLog(s: string): string {
  let node: Node;
  try {
    node = parse(s);
  } catch {
    return s;
  }
  const out = node.transform((n) => rewriteExpLog(n));
  return str(out);
}

function isE(n: Node): boolean {
  return n.type === 'SymbolNode' && (n as unknown as { name: string }).name === 'e';
}

function unparen(n: Node): Node {
  while (n.type === 'ParenthesisNode') n = (n as unknown as { content: Node }).content;
  return n;
}

function sumTerms(n: Node, sign = 1, out: { sign: number; node: Node }[] = []) {
  n = unparen(n);
  if (n.type === 'OperatorNode') {
    const op = n as unknown as { op: string; fn: string; args: Node[] };
    if (op.fn === 'add') {
      sumTerms(op.args[0], sign, out);
      sumTerms(op.args[1], sign, out);
      return out;
    }
    if (op.fn === 'subtract') {
      sumTerms(op.args[0], sign, out);
      sumTerms(op.args[1], -sign, out);
      return out;
    }
    if (op.fn === 'unaryMinus') {
      sumTerms(op.args[0], -sign, out);
      return out;
    }
  }
  out.push({ sign, node: n });
  return out;
}

/** If n is k*log(u) with numeric k, return [k, u]. */
function asLogTerm(n: Node): [string, Node] | null {
  n = unparen(n);
  if (n.type === 'FunctionNode' && (n as unknown as { fn: { name: string } }).fn.name === 'log') {
    return ['1', (n as unknown as { args: Node[] }).args[0]];
  }
  if (n.type === 'OperatorNode') {
    const op = n as unknown as { fn: string; args: Node[] };
    if (op.fn === 'multiply' || op.fn === 'divide') {
      const [a, b] = op.args;
      const la = asLogTerm(a);
      const lb = asLogTerm(b);
      if (op.fn === 'multiply' && la && isNumeric(b)) return [`(${la[0]})*(${str(b)})`, la[1]];
      if (op.fn === 'multiply' && lb && isNumeric(a)) return [`(${lb[0]})*(${str(a)})`, lb[1]];
      if (op.fn === 'divide' && la && isNumeric(b)) return [`(${la[0]})/(${str(b)})`, la[1]];
    }
    if (op.fn === 'unaryMinus') {
      const l = asLogTerm(op.args[0]);
      if (l) return [`-(${l[0]})`, l[1]];
    }
  }
  return null;
}

function isNumeric(n: Node): boolean {
  const syms = symbols(str(n));
  return [...syms].every((s) => s === 'pi' || s === 'e') && syms.size === 0;
}

function rewriteExpLog(n: Node): Node {
  if (n.type === 'OperatorNode' && (n as unknown as { fn: string }).fn === 'pow') {
    const [base, exp] = (n as unknown as { args: Node[] }).args;
    if (!isE(unparen(base))) return n;
    const terms = sumTerms(exp);
    const logs: string[] = [];
    const rest: string[] = [];
    for (const t of terms) {
      const l = asLogTerm(t.node);
      if (l) {
        const k = norm(`${t.sign}*${l[0]}`);
        logs.push(k === '1' ? `(${str(l[1])})` : `(${str(l[1])})^(${k})`);
      } else rest.push(`${t.sign < 0 ? '-' : '+'}(${str(t.node)})`);
    }
    if (!logs.length) return n;
    const parts = [...logs];
    if (rest.length) parts.push(`e^(${rest.join('')})`);
    return parse(parts.join('*'));
  }
  if (n.type === 'FunctionNode' && (n as unknown as { fn: { name: string } }).fn.name === 'log') {
    const arg = unparen((n as unknown as { args: Node[] }).args[0]);
    if (arg.type === 'OperatorNode' && (arg as unknown as { fn: string }).fn === 'pow') {
      const [b, e] = (arg as unknown as { args: Node[] }).args;
      if (isE(unparen(b))) return e;
    }
    if (isE(arg)) return parse('1');
  }
  return n;
}

/**
 * Simplify, choosing the shortest of several candidate forms that are
 * numerically equivalent to the input.
 */
export function simplify(s: string, vars: string[] = ['x', 'y']): string {
  const cands: string[] = [];
  const add = (f: () => string) => {
    try {
      const r = cleanup(f());
      if (r && !cands.includes(r)) cands.push(r);
    } catch {
      /* ignore */
    }
  };
  add(() => norm(s));
  add(() => norm(expLog(s)));
  add(() => cleanup((nerdamer as unknown as { simplify(s: string): N }).simplify(norm(expLog(s))).toString()));
  add(() => expand(norm(expLog(s))));
  add(() => distribute(norm(expLog(s))));
  add(() => factor(norm(expLog(s))));
  if (/\b(sec|csc|tan|cot)\(/.test(s)) {
    const trig = s
      .replace(/\bsec\(/g, '1/cos(')
      .replace(/\bcsc\(/g, '1/sin(')
      .replace(/\btan\(/g, 'TAN(')
      .replace(/\bcot\(/g, 'COT(');
    const t2 = expandTanCot(trig);
    add(() => (nerdamer as unknown as { simplify(s: string): N }).simplify(t2).toString());
    add(() => expand(t2));
  }
  let best = cands[0] ?? s;
  let bestScore = score(best);
  for (const c of cands.slice(1)) {
    const sc = score(c);
    if (sc < bestScore && numEqual(c, s, vars)) {
      best = c;
      bestScore = sc;
    }
  }
  return best;
}

function expandTanCot(s: string): string {
  // TAN(a) -> (sin(a)/cos(a)), COT(a) -> (cos(a)/sin(a)), with balanced parens
  let out = s;
  for (const [tok, f] of [['TAN(', (a: string) => `(sin(${a})/cos(${a}))`], ['COT(', (a: string) => `(cos(${a})/sin(${a}))`]] as const) {
    let idx: number;
    while ((idx = out.indexOf(tok)) >= 0) {
      let depth = 0;
      let j = idx + tok.length - 1;
      for (; j < out.length; j++) {
        if (out[j] === '(') depth++;
        if (out[j] === ')') {
          depth--;
          if (depth === 0) break;
        }
      }
      const arg = out.slice(idx + tok.length, j);
      out = out.slice(0, idx) + f(arg) + out.slice(j + 1);
    }
  }
  return out;
}

function score(s: string): number {
  // Prefer short expressions without negative exponents.
  return s.length + (s.match(/\^-/g)?.length ?? 0) * 2 + (s.match(/\^\(-/g)?.length ?? 0) * 2;
}

export function isZeroSym(s: string): boolean {
  return norm(s) === '0';
}

export function isNumber(s: string): boolean {
  const syms = symbols(s);
  syms.delete('pi');
  syms.delete('e');
  return syms.size === 0;
}
