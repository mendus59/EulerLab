/**
 * LaTeX pretty-printer for expression strings. Produces textbook-style
 * output: implicit multiplication, fractions, ln, sqrt, constants first.
 */
import { parse } from './math';
import type { Node } from './math';

export interface TexOpts {
  /** Rename internal symbols for display, e.g. { x: 't', y: 'P' }. */
  rename?: Record<string, string>;
}

const GREEK = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu',
  'nu', 'xi', 'rho', 'sigma', 'tau', 'phi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda',
  'Sigma', 'Phi', 'Psi', 'Omega',
]);

const FN_TEX: Record<string, string> = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', sec: '\\sec', csc: '\\csc', cot: '\\cot',
  asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan',
  asec: '\\operatorname{arcsec}', acsc: '\\operatorname{arccsc}', acot: '\\operatorname{arccot}',
  sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh',
  asinh: '\\operatorname{arsinh}', acosh: '\\operatorname{arcosh}', atanh: '\\operatorname{artanh}',
  log: '\\ln',
};

type Any = Node & { [k: string]: any };

function u(n: Node): Any {
  let m = n as Any;
  while (m.type === 'ParenthesisNode') m = m.content;
  return m;
}

export function tex(expr: string, opts: TexOpts = {}): string {
  let node: Node;
  try {
    node = parse(expr);
  } catch {
    return `\\text{${expr}}`;
  }
  return new Printer(opts).print(node);
}

/** Display an equation lhs = rhs. */
export function texEq(lhs: string, rhs: string, opts: TexOpts = {}): string {
  return `${tex(lhs, opts)} = ${tex(rhs, opts)}`;
}

interface Factor {
  node: Any;
  exp: Any | null; // exponent node (positive), null = 1
}

class Printer {
  constructor(private opts: TexOpts) {}

  sym(name: string): string {
    const r = this.opts.rename?.[name];
    if (r) name = r;
    if (name === 'pi') return '\\pi';
    if (name === 'yp') return `${this.sym('y')}'`;
    if (name === 'ypp') return `${this.sym('y')}''`;
    if (GREEK.has(name)) return `\\${name}`;
    const m = /^([A-Za-z])_?(\d+)$/.exec(name);
    if (m) return `${m[1]}_{${m[2]}}`;
    const g = /^([a-zA-Z]+)_?(\d+)$/.exec(name);
    if (g && GREEK.has(g[1])) return `\\${g[1]}_{${g[2]}}`;
    if (name.length > 1) return `\\mathrm{${name}}`;
    return name;
  }

  print(n: Node): string {
    const s = this.sum(n);
    return s;
  }

  // ---- sums
  sum(n: Node, flip = 1): string {
    const terms: { sign: number; node: Any }[] = [];
    collectSum(n, flip, terms);
    if (terms.length === 1 && terms[0].sign > 0) return this.product(terms[0].node);
    const sorted = sortTerms(terms);
    if (sorted.length === 2) {
      const neg = (t: { sign: number; node: Any }) => (t.sign < 0) !== this.product(t.node).startsWith('-');
      if (neg(sorted[0]) && !neg(sorted[1])) sorted.reverse();
    }
    let out = '';
    sorted.forEach((t, i) => {
      let body = this.product(t.node);
      let sign = t.sign;
      if (body.startsWith('-')) {
        sign = -sign;
        body = body.slice(1);
      }
      if (i === 0) out += (sign < 0 ? '-' : '') + body;
      else out += (sign < 0 ? ' - ' : ' + ') + body;
    });
    return out;
  }

  // ---- products / quotients
  product(n: Node): string {
    const num: Factor[] = [];
    const den: Factor[] = [];
    const coef = { p: 1, q: 1, sign: 1 };
    collectProduct(n, false, num, den, coef);
    if (coef.p === 0) return '0';
    const p = coef.p;
    const q = coef.q;
    // Normalise signs of a lone sum in numerator/denominator: (-1 - e^x) -> -(e^x + 1)
    for (const list of [num, den]) {
      if (list.length === 1 && !list[0].exp && isSum(list[0].node) && this.sum(list[0].node).startsWith('-')) {
        list[0] = { node: parse(`-(${list[0].node.toString()})`) as Any, exp: null };
        coef.sign *= -1;
      }
    }
    if (coef.sign < 0 && den.length === 1 && !den[0].exp && isSum(den[0].node)) {
      den[0] = { node: parse(`-(${den[0].node.toString()})`) as Any, exp: null };
      coef.sign = 1;
    }
    const numStr = this.factorList(num, p !== 1 || (q !== 1 && !den.length));
    const denStr = this.factorList(den, q !== 1);
    const sign = coef.sign < 0 ? '-' : '';
    if (!den.length && q === 1) {
      if (!numStr) return sign + fmtNum(p);
      if (p === 1) return sign + numStr;
      return sign + fmtNum(p) + joinCoef(numStr);
    }
    const top = numStr ? (p === 1 ? numStr : fmtNum(p) + joinCoef(numStr)) : fmtNum(p);
    const bottom = denStr ? (q === 1 ? denStr : fmtNum(q) + joinCoef(denStr)) : fmtNum(q);
    // A simple rational coefficient in front reads better: \frac{1}{2} x^2
    if (!den.length && numStr && num.length === 1 && isAtomicFactor(num[0]) === false) {
      return `${sign}\\frac{${fmtNum(p)}}{${fmtNum(q)}}${joinCoef(numStr)}`;
    }
    return `${sign}\\frac{${top}}{${bottom}}`;
  }

  factorList(fs: Factor[], hasCoef = false): string {
    const sorted = [...fs].sort((a, b) => factorRank(a) - factorRank(b));
    const parts = sorted.map((f) => this.factor(f, sorted.length > 1 || hasCoef));
    let out = '';
    parts.forEach((p, i) => {
      if (i === 0) out = p;
      else {
        const needDot = /^[\d.]/.test(p);
        if (needDot) out += ' \\cdot ' + p;
        else if (/^[a-zA-Z]/.test(p) && !/\\[a-zA-Z]+$/.test(out)) out += p;
        else out += ' ' + p;
      }
    });
    return out;
  }

  factor(f: Factor, inProduct: boolean): string {
    const base = f.node;
    if (!f.exp) return this.atom(base, inProduct);
    return this.power(base, f.exp);
  }

  power(base: Any, exp: Any): string {
    const ex = u(exp);
    // roots
    const r = rationalOf(ex);
    if (r && r[0] === 1 && r[1] === 2) return `\\sqrt{${this.sum(base)}}`;
    if (r && r[0] === 1 && r[1] > 2) return `\\sqrt[${r[1]}]{${this.sum(base)}}`;
    if (r && r[1] === 2 && r[0] > 1) return `\\left(\\sqrt{${this.sum(base)}}\\right)^{${r[0]}}`;
    const b = u(base);
    let bs: string;
    if (b.type === 'SymbolNode' || (b.type === 'ConstantNode' && b.value >= 0)) bs = this.atom(b, false);
    else if (b.type === 'FunctionNode' && FN_TEX[b.fn.name] && b.fn.name !== 'log') {
      // sin^2 x style
      return `${FN_TEX[b.fn.name]}^{${this.sum(ex)}}${this.fnArg(b.args[0])}`;
    } else bs = `\\left(${this.sum(b)}\\right)`;
    return `${bs}^{${this.sum(ex)}}`;
  }

  fnArg(a: Node): string {
    const x = u(a);
    if (x.type === 'SymbolNode' || (x.type === 'ConstantNode' && x.value >= 0)) return ' ' + this.atom(x, false);
    return `\\left(${this.sum(x)}\\right)`;
  }

  atom(n: Any, inProduct: boolean): string {
    n = u(n);
    switch (n.type) {
      case 'SymbolNode':
        return this.sym(n.name);
      case 'ConstantNode':
        return fmtNum(Number(n.value));
      case 'FunctionNode': {
        const name: string = n.fn.name;
        if (name === 'sqrt') return `\\sqrt{${this.sum(n.args[0])}}`;
        if (name === 'cbrt') return `\\sqrt[3]{${this.sum(n.args[0])}}`;
        if (name === 'abs') return `\\left|${this.sum(n.args[0])}\\right|`;
        if (name === 'exp') return `e^{${this.sum(n.args[0])}}`;
        if (name === 'integrate' && n.args.length === 2) {
          const v = this.atom(n.args[1], false);
          return `\\int ${this.sum(n.args[0])} \\, d${v}`;
        }
        if (name === 'log') {
          const a = u(n.args[0]);
          const isTrig = a.type === 'FunctionNode' && ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'].includes(a.fn.name);
          const absArg = (a.type === 'SymbolNode' && a.name !== 'e') || isTrig || (isSum(a) && /-/.test(a.toString()));
          if (a.type === 'FunctionNode' && a.fn.name === 'abs') return `\\ln\\left|${this.sum(a.args[0])}\\right|`;
          if (absArg) return `\\ln\\left|${this.sum(a)}\\right|`;
        }
        if (FN_TEX[name]) return FN_TEX[name] + this.fnArg(n.args[0]);
        return `\\operatorname{${name}}\\left(${n.args.map((a: Node) => this.sum(a)).join(', ')}\\right)`;
      }
      case 'OperatorNode': {
        if (n.fn === 'pow') return this.power(n.args[0], n.args[1]);
        const terms: { sign: number; node: Any }[] = [];
        collectSum(n, 1, terms);
        if (terms.length > 1) {
          const s = this.sum(n);
          return inProduct ? `\\left(${s}\\right)` : s;
        }
        return this.product(n);
      }
      default:
        return n.toString();
    }
  }
}

function joinCoef(s: string): string {
  return /^[\d.]/.test(s) ? ' \\cdot ' + s : s.startsWith('\\left(') ? s : s;
}

function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  const r = +v.toPrecision(10);
  return String(r);
}

function rationalOf(n: Any): [number, number] | null {
  n = u(n);
  if (n.type === 'ConstantNode') {
    const v = Number(n.value);
    return Number.isInteger(v) ? [v, 1] : null;
  }
  if (n.type === 'OperatorNode' && n.fn === 'divide') {
    const a = rationalOf(n.args[0]);
    const b = rationalOf(n.args[1]);
    if (a && b && a[1] === 1 && b[1] === 1) return [a[0], b[0]];
  }
  if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') {
    const a = rationalOf(n.args[0]);
    if (a) return [-a[0], a[1]];
  }
  return null;
}

function collectSum(n: Node, sign: number, out: { sign: number; node: Any }[]) {
  const m = u(n);
  if (m.type === 'OperatorNode') {
    if (m.fn === 'add') {
      collectSum(m.args[0], sign, out);
      collectSum(m.args[1], sign, out);
      return;
    }
    if (m.fn === 'subtract') {
      collectSum(m.args[0], sign, out);
      collectSum(m.args[1], -sign, out);
      return;
    }
    if (m.fn === 'unaryMinus') {
      const inner: { sign: number; node: Any }[] = [];
      collectSum(m.args[0], 1, inner);
      if (inner.length > 1) {
        for (const t of inner) out.push({ sign: -sign * t.sign, node: t.node });
        return;
      }
    }
  }
  out.push({ sign, node: m });
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function collectProduct(n: Node, inv: boolean, num: Factor[], den: Factor[], coef: { p: number; q: number; sign: number }) {
  const m = u(n);
  if (m.type === 'OperatorNode') {
    if (m.fn === 'multiply') {
      collectProduct(m.args[0], inv, num, den, coef);
      collectProduct(m.args[1], inv, num, den, coef);
      return;
    }
    if (m.fn === 'divide') {
      collectProduct(m.args[0], inv, num, den, coef);
      collectProduct(m.args[1], !inv, num, den, coef);
      return;
    }
    if (m.fn === 'unaryMinus') {
      const terms: { sign: number; node: Any }[] = [];
      collectSum(m.args[0], 1, terms);
      if (terms.length === 1) {
        coef.sign *= -1;
        collectProduct(m.args[0], inv, num, den, coef);
        return;
      }
    }
    if (m.fn === 'pow' && !(u(m.args[0]).type === 'SymbolNode' && (u(m.args[0]) as Any).name === 'e')) {
      const r = rationalOf(m.args[1]);
      if (r && r[0] < 0) {
        const pos = -r[0];
        const expNode = r[1] === 1 ? (pos === 1 ? null : (parse(String(pos)) as Any)) : (parse(`${pos}/${r[1]}`) as Any);
        (inv ? num : den).push({ node: u(m.args[0]), exp: expNode });
        return;
      }
      const e = u(m.args[1]);
      if (e.type === 'OperatorNode' && e.fn === 'unaryMinus') {
        (inv ? num : den).push({ node: u(m.args[0]), exp: u(e.args[0]) });
        return;
      }
      (inv ? den : num).push({ node: u(m.args[0]), exp: e });
      return;
    }
    if (m.fn === 'pow') {
      (inv ? den : num).push({ node: u(m.args[0]), exp: u(m.args[1]) });
      return;
    }
  }
  if (m.type === 'ConstantNode') {
    let v = Number(m.value);
    if (v < 0) {
      coef.sign *= -1;
      v = -v;
    }
    let p: number, q: number;
    if (Number.isInteger(v)) {
      p = v;
      q = 1;
    } else {
      // decimals -> keep as a factor
      (inv ? den : num).push({ node: m, exp: null });
      return;
    }
    if (inv) [p, q] = [q, p];
    coef.p *= p;
    coef.q *= q;
    const g = gcd(coef.p, coef.q);
    coef.p /= g;
    coef.q /= g;
    return;
  }
  (inv ? den : num).push({ node: m, exp: null });
}

function isAtomicFactor(f: Factor): boolean {
  const n = u(f.node);
  return n.type === 'SymbolNode' || n.type === 'ConstantNode';
}

function isSum(n: Any): boolean {
  const m = u(n);
  return m.type === 'OperatorNode' && (m.fn === 'add' || m.fn === 'subtract');
}

/** Ordering of factors in a product: constants, C's, parameters, x-powers, functions, sums. */
function factorRank(f: Factor): number {
  const n = u(f.node);
  if (n.type === 'ConstantNode') return 0;
  if (n.type === 'SymbolNode') {
    const name: string = n.name;
    if (name === 'pi') return 1;
    if (/^C\d*$/.test(name) || /^[AB]\d*$/.test(name)) return 2;
    if (name === 'e') return 6;
    if (['x', 'y', 't', 'v', 'u', 'yp', 'ypp'].includes(name)) return 4;
    return 3;
  }
  if (n.type === 'FunctionNode') {
    if (n.fn.name === 'sqrt' || n.fn.name === 'cbrt') return 4.5;
    if (n.fn.name === 'log') return 7.5;
    return 7;
  }
  if (isSum(n)) return 8;
  return 5;
}

function termHasC(n: Any): string | null {
  let found: string | null = null;
  n.traverse((m: Any) => {
    if (m.type === 'SymbolNode' && /^C\d*$/.test(m.name) && !found) found = m.name;
  });
  return found;
}

const XW: Record<string, number> = { x: 1, y: 1, t: 1, r: 1, v: 1, u: 1, yp: 10, ypp: 20 };
const XVARS = new Set(Object.keys(XW));

function termDegree(n: Any): number {
  // crude: total exponent of x-like symbols at the top product level
  let deg = 0;
  const visit = (m: Any, mult: number) => {
    m = u(m);
    if (m.type === 'SymbolNode' && XVARS.has(m.name)) deg += mult * XW[m.name];
    else if (m.type === 'OperatorNode' && m.fn === 'multiply') {
      visit(m.args[0], mult);
      visit(m.args[1], mult);
    } else if (m.type === 'OperatorNode' && m.fn === 'divide') {
      visit(m.args[0], mult);
      visit(m.args[1], -mult);
    } else if (m.type === 'OperatorNode' && m.fn === 'unaryMinus') visit(m.args[0], mult);
    else if (m.type === 'OperatorNode' && m.fn === 'pow') {
      const r = rationalOf(m.args[1]);
      const b = u(m.args[0]);
      if (r && b.type === 'SymbolNode' && XVARS.has(b.name)) deg += (mult * XW[b.name] * r[0]) / r[1];
    }
  };
  visit(n, 1);
  return deg;
}

function sortTerms(terms: { sign: number; node: Any }[]) {
  return terms
    .map((t, i) => ({ t, i, c: termHasC(t.node), d: termDegree(t.node) }))
    .sort((a, b) => {
      if (!!a.c !== !!b.c) return a.c ? 1 : -1;
      if (a.c && b.c && a.c !== b.c) return a.c < b.c ? -1 : 1;
      if (a.d !== b.d) return b.d - a.d;
      return a.i - b.i;
    })
    .map((x) => x.t);
}
