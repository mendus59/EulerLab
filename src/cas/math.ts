/**
 * Thin wrapper around math.js used for parsing, tree inspection and fast
 * numeric evaluation. Symbolic heavy lifting (integration, solving) lives in
 * sym.ts, which uses nerdamer.
 */
import { create, all } from 'mathjs';
import type { MathNode } from 'mathjs';

export const math = create(all, {});
export type Node = MathNode;

export const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
  'asin', 'acos', 'atan', 'asec', 'acsc', 'acot',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'log', 'exp', 'sqrt', 'cbrt', 'abs',
]);

/** Symbols that are never free parameters. */
const RESERVED = new Set(['e', 'pi', 'i', 'x', 'y', 'yp', 'ypp', 'DX', 'DY']);

export function parse(s: string): Node {
  return math.parse(s);
}

export function str(n: Node): string {
  return n.toString({ parenthesis: 'auto', implicit: 'show' });
}

const compiled = new Map<string, { evaluate: (scope: Record<string, unknown>) => unknown }>();

/** Evaluate an expression numerically. Returns NaN for non-real or invalid values. */
export function evalAt(expr: string, scope: Record<string, number>): number {
  let c = compiled.get(expr);
  if (!c) {
    try {
      c = math.compile(expr);
    } catch {
      return NaN;
    }
    if (compiled.size > 5000) compiled.clear();
    compiled.set(expr, c);
  }
  try {
    const v = c.evaluate({ ...scope }) as unknown;
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    if (v && typeof v === 'object' && 'im' in v && 're' in v) {
      const z = v as { re: number; im: number };
      return Math.abs(z.im) <= 1e-10 * Math.max(1, Math.abs(z.re)) ? z.re : NaN;
    }
    if (v && typeof v === 'object' && 'valueOf' in v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    }
    return NaN;
  } catch {
    return NaN;
  }
}

/** Free symbol names in an expression (excluding function names). */
export function symbols(expr: string): Set<string> {
  const out = new Set<string>();
  let node: Node;
  try {
    node = parse(expr);
  } catch {
    return out;
  }
  node.traverse((n, _path, parent) => {
    if (n.type === 'SymbolNode') {
      const isFnName = parent && parent.type === 'FunctionNode' && (parent as unknown as { fn: Node }).fn === n;
      if (!isFnName) out.add((n as unknown as { name: string }).name);
    }
  });
  return out;
}

/** Free parameters: symbols other than the reserved variable names and integration constants. */
export function params(expr: string): string[] {
  return [...symbols(expr)].filter((s) => !RESERVED.has(s) && !/^C\d*$/.test(s));
}

// ---------------------------------------------------------------------------
// Deterministic sampling for numeric identity tests

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SampleOpts {
  vars: string[];
  /** Extra symbols (parameters, constants) to fill with random values. */
  extra?: string[];
  count?: number;
  lo?: number;
  hi?: number;
  seed?: number;
}

export function samplePoints(opts: SampleOpts): Record<string, number>[] {
  const { vars, extra = [], count = 14, lo = 0.25, hi = 2.3, seed = 12345 } = opts;
  const rnd = mulberry32(seed);
  const pts: Record<string, number>[] = [];
  for (let i = 0; i < count; i++) {
    const p: Record<string, number> = {};
    for (const v of vars) p[v] = lo + (hi - lo) * rnd();
    for (const v of extra) p[v] = 0.6 + 1.1 * rnd();
    pts.push(p);
  }
  return pts;
}

function allSymbols(exprs: string[]): string[] {
  const s = new Set<string>();
  for (const e of exprs) for (const v of symbols(e)) s.add(v);
  return [...s];
}

/** Collect the symbols in exprs that need random values, beyond `vars`. */
function extrasFor(exprs: string[], vars: string[]): string[] {
  return allSymbols(exprs).filter((v) => !vars.includes(v) && v !== 'e' && v !== 'pi' && v !== 'i');
}

/**
 * Numerically test whether a == b as functions of `vars` (other symbols get
 * random values). Requires a minimum number of valid sample points.
 */
export function numEqual(a: string, b: string, vars: string[], opts: Partial<SampleOpts> = {}): boolean {
  const extra = extrasFor([a, b], vars);
  const pts = samplePoints({ vars, extra, ...opts });
  let valid = 0;
  for (const p of pts) {
    const va = evalAt(a, p);
    const vb = evalAt(b, p);
    if (Number.isNaN(va) || Number.isNaN(vb)) continue;
    valid++;
    if (Math.abs(va - vb) > 1e-7 * (1 + Math.abs(va) + Math.abs(vb))) return false;
  }
  return valid >= 4;
}

export function numZero(a: string, vars: string[], opts: Partial<SampleOpts> = {}): boolean {
  return numEqual(a, '0', vars, opts);
}

/** Does expr depend on variable v (numerically)? */
export function dependsOn(expr: string, v: string, vars: string[]): boolean {
  if (!symbols(expr).has(v)) return false;
  const extra = extrasFor([expr], vars);
  const pts = samplePoints({ vars, extra, seed: 999 });
  let valid = 0;
  for (const p of pts) {
    const a = evalAt(expr, p);
    const q = { ...p, [v]: p[v] * 1.37 + 0.41 };
    const b = evalAt(expr, q);
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    valid++;
    if (Math.abs(a - b) > 1e-8 * (1 + Math.abs(a) + Math.abs(b))) return true;
  }
  // Could not establish independence robustly: assume dependence if no valid points.
  return valid < 3;
}

/** Best rational approximation p/q with q <= maxDen; null if not close enough. */
export function rationalize(v: number, maxDen = 2000, tol = 1e-9): [number, number] | null {
  if (!Number.isFinite(v)) return null;
  const sign = v < 0 ? -1 : 1;
  let x = Math.abs(v);
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(x);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(Math.abs(v) - h1 / k1) <= tol * Math.max(1, Math.abs(v))) return [sign * h1, k1];
    const frac = x - a;
    if (frac < 1e-15) break;
    x = 1 / frac;
  }
  if (k1 > 0 && Math.abs(Math.abs(v) - h1 / k1) <= tol * Math.max(1, Math.abs(v))) return [sign * h1, k1];
  return null;
}

export function ratStr([p, q]: [number, number]): string {
  if (q === 1) return String(p);
  return `(${p}/${q})`;
}
