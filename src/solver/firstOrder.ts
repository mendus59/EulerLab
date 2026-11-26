import { numEqual, dependsOn, samplePoints, evalAt, symbols, rationalize, parse, str } from '../cas/math';
import type { Node } from '../cas/math';
import { simplify, integrate, diff, subs, solve, factor, expand, norm, expLog, splitTopLevel, distribute } from '../cas/sym';
import { Disp } from './context';
import type { MethodResult, Step, GeneralSolution } from './types';

const XY = ['x', 'y'];

export interface FirstOrderCtx {
  /** y' = f(x, y) */
  f: string;
  /** Original form M + N y' = 0 */
  M: string;
  N: string;
  differentialForm: boolean;
  d: Disp;
}

// ---------------------------------------------------------------------------
// helpers

type Any = Node & { [k: string]: any };
function u(n: Node): Any {
  let m = n as Any;
  while (m.type === 'ParenthesisNode') m = m.content;
  return m;
}

/** Flatten a product into factors with exponent sign. */
function productFactors(n: Node, inv = false, out: { node: Any; inv: boolean }[] = []) {
  const m = u(n);
  if (m.type === 'OperatorNode') {
    if (m.fn === 'multiply') {
      productFactors(m.args[0], inv, out);
      productFactors(m.args[1], inv, out);
      return out;
    }
    if (m.fn === 'divide') {
      productFactors(m.args[0], inv, out);
      productFactors(m.args[1], !inv, out);
      return out;
    }
    if (m.fn === 'unaryMinus') {
      out.push({ node: parse('-1') as Any, inv: false });
      productFactors(m.args[0], inv, out);
      return out;
    }
  }
  out.push({ node: m, inv });
  return out;
}

function sumTermsStr(s: string): string[] {
  const terms: string[] = [];
  const visit = (n: Node, sign: number) => {
    const m = u(n);
    if (m.type === 'OperatorNode' && m.fn === 'add') {
      visit(m.args[0], sign);
      visit(m.args[1], sign);
    } else if (m.type === 'OperatorNode' && m.fn === 'subtract') {
      visit(m.args[0], sign);
      visit(m.args[1], -sign);
    } else if (m.type === 'OperatorNode' && m.fn === 'unaryMinus') {
      visit(m.args[0], -sign);
    } else terms.push(sign < 0 ? `-(${str(m)})` : str(m));
  };
  visit(parse(s), 1);
  return terms;
}
export { sumTermsStr, productFactors };

function numericSeparable(f: string): boolean {
  const pts = samplePoints({ vars: ['a', 'b', 'c', 'd'], count: 12, seed: 77 });
  let valid = 0;
  for (const p of pts) {
    const f1 = evalAt(f, { x: p.a, y: p.b });
    const f2 = evalAt(f, { x: p.c, y: p.d });
    const f3 = evalAt(f, { x: p.a, y: p.d });
    const f4 = evalAt(f, { x: p.c, y: p.b });
    if ([f1, f2, f3, f4].some(Number.isNaN)) continue;
    valid++;
    const l = f1 * f2;
    const r = f3 * f4;
    if (Math.abs(l - r) > 1e-8 * (1 + Math.abs(l) + Math.abs(r))) return false;
  }
  return valid >= 4;
}

function withParamsNumericSeparable(f: string): boolean {
  // substitute random values for parameters first
  const ps = [...symbols(f)].filter((s) => !['x', 'y', 'e', 'pi'].includes(s));
  let g = f;
  ps.forEach((p, i) => (g = subs(g, { [p]: String(0.7 + 0.37 * i) })));
  return numericSeparable(g);
}

/** Split f(x,y) = g(x) h(y). */
export function separate(f: string): { g: string; h: string } | null {
  if (!withParamsNumericSeparable(f)) return null;
  const cands = [f, factor(f), simplify(f), norm(expLog(f))];
  for (const c of cands) {
    let node: Node;
    try {
      node = parse(c);
    } catch {
      continue;
    }
    const fs = productFactors(node);
    const gx: string[] = [];
    const hy: string[] = [];
    let ok = true;
    for (const { node: fn, inv } of fs) {
      const s = str(fn);
      const syms = symbols(s);
      const hx = syms.has('x');
      const hasY = syms.has('y');
      const put = (arr: string[], e: string) => arr.push(inv ? `(${e})^(-1)` : `(${e})`);
      if (hx && hasY) {
        // e^(a(x) + b(y)) splits into e^a * e^b
        if (fn.type === 'OperatorNode' && fn.fn === 'pow' && u(fn.args[0]).type === 'SymbolNode' && u(fn.args[0]).name === 'e') {
          const terms = sumTermsStr(str(fn.args[1]));
          const ex: string[] = [];
          const ey: string[] = [];
          for (const t of terms) {
            const ts = symbols(t);
            if (ts.has('x') && ts.has('y')) {
              ok = false;
              break;
            }
            (ts.has('y') ? ey : ex).push(t);
          }
          if (!ok) break;
          if (ex.length) put(gx, `e^(${ex.join('+')})`);
          if (ey.length) put(hy, `e^(${ey.join('+')})`);
          continue;
        }
        ok = false;
        break;
      }
      put(hasY ? hy : gx, s);
    }
    if (!ok) continue;
    const g = simplify(gx.length ? gx.join('*') : '1', XY);
    const h = simplify(hy.length ? hy.join('*') : '1', XY);
    if (numEqual(`(${g})*(${h})`, f, XY)) return { g, h };
  }
  // fallback: g(x) = f(x, b), h(y) = f(a, y) / f(a, b)
  for (const [a, b] of [['1', '1'], ['1', '2'], ['2', '1'], ['0', '1'], ['1', '0']]) {
    const fab = simplify(subs(f, { x: a, y: b }), XY);
    if (norm(fab) === '0' || !Number.isFinite(evalAt(fab, {}))) continue;
    const g = simplify(`(${subs(f, { y: b })})`, XY);
    const h = simplify(`(${subs(f, { x: a })})/(${fab})`, XY);
    if (numEqual(`(${g})*(${h})`, f, XY)) return { g, h };
  }
  return null;
}

/** If s is k*log(U) with numeric k, return [k, U]. */
function logForm(s: string): [string, string] | null {
  const terms = sumTermsStr(simplify(s, XY.concat(['v'])));
  // combine single log term
  if (terms.length !== 1) {
    // try nerdamer combining logs via simplify of exp
    return null;
  }
  const t = terms[0];
  const fs = productFactors(parse(t));
  let k = '1';
  let U: string | null = null;
  for (const { node, inv } of fs) {
    const s2 = str(node);
    if (node.type === 'FunctionNode' && node.fn.name === 'log' && !inv && !U) {
      U = str(node.args[0]);
      continue;
    }
    if (symbols(s2).size === 0) {
      k = inv ? `(${k})/(${s2})` : `(${k})*(${s2})`;
      continue;
    }
    return null;
  }
  if (!U) return null;
  return [norm(k), U];
}

function goodExplicit(sol: string): boolean {
  if (/\bi\b/.test(sol)) return false;
  if (/abs\(/.test(sol)) return false;
  if (sol.length > 160) return false;
  if (/cbrt\(.*cbrt\(/.test(sol)) return false;
  return true;
}

/** Residual check of y = Y for y' = f(x,y). */
export function verifyExplicit1(Y: string, f: string): boolean {
  try {
    const Yp = diff(Y, 'x');
    const r = `(${Yp})-(${subs(f, { y: Y })})`;
    return numEqual(r, '0', ['x', 'C'], { count: 40, lo: 0.3, hi: 1.9 }) || numEqual(r, '0', ['x', 'C'], { count: 40, lo: -1.5, hi: -0.2, seed: 3 });
  } catch {
    return false;
  }
}

/** Residual check of G(x,y) = C for y' = f. */
export function verifyImplicit1(G: string, f: string): boolean {
  try {
    const Gx = diff(G, 'x');
    const Gy = diff(G, 'y');
    // Gx + Gy f = 0
    return numEqual(`(${Gx})+(${Gy})*(${f})`, '0', XY, { count: 40 });
  } catch {
    return false;
  }
}

/**
 * Given H(y) = G(x) + C (H, G strings), try to solve for y and produce steps.
 * yVar is the internal name of the unknown in H (usually y, or v).
 */
function solveForY(H: string, G: string, d: Disp, yVar: string, f: string | null, steps: Step[]): GeneralSolution {
  const dy = d.with({});
  // log form: k ln U = G + C  ->  U = C e^{G/k}
  const lf = logForm(H);
  if (lf) {
    const [k, U] = lf;
    const expo = simplify(k === '1' ? G : `(${G})/(${k})`, XY);
    const rhs = simplify(expLog(`C*e^(${expo})`), XY);
    const sols = solve(`(${U})-(${rhs})`, yVar).map((s) => simplify(s, XY.concat(['C']))).filter(goodExplicit);
    const okSols = f ? sols.filter((s) => verifyExplicit1(s, f)) : sols;
    if (okSols.length) {
      steps.push({
        title: 'Solve for ' + d.y,
        text:
          (k === '1' ? '' : `Divide by ${d.i(k)}, then `) +
          'exponentiate both sides. The constant $e^{C}$ (with a $\\pm$ for the absolute value) is just another arbitrary constant, so we rename it $C$.',
        math: [
          `${dy.t(U)} = ${dy.t(rhs)}`,
          ...(okSols.length === 1 && norm(U) === yVar ? [] : okSols.map((s) => `${d.y} = ${d.t(s)}`)),
        ],
      });
      return { kind: 'explicit', exprs: okSols };
    }
  }
  const sols = solve(`(${H})-(${G})-C`, yVar).map((s) => simplify(s, XY.concat(['C']))).filter(goodExplicit);
  const okSols = f ? sols.filter((s) => verifyExplicit1(s, f)) : sols;
  if (okSols.length && okSols.length <= 2) {
    steps.push({
      title: 'Solve for ' + d.y,
      text: okSols.length > 1 ? 'Solving for the unknown gives two branches:' : 'Isolate the unknown:',
      math: okSols.map((s) => `${d.y} = ${d.t(s)}`),
    });
    return { kind: 'explicit', exprs: okSols };
  }
  const lhs = simplify(`(${H})-(${G})`, XY);
  steps.push({
    title: 'Leave the solution in implicit form',
    text: `Solving for ${d.i('y')} explicitly is not practical here, so we keep the answer as an equation relating ${d.i('x')} and ${d.i('y')}. That is a perfectly valid (implicit) solution.`,
    math: [`${d.t(lhs)} = C`],
  });
  return { kind: 'implicit', lhs, rhs: 'C' };
}

function intOrSymbolic(expr: string, v: string): { r: string; ok: boolean } {
  const r = integrate(expr, v);
  if (r) return { r: simplify(r, XY.concat(['v'])), ok: true };
  return { r: `integrate(${expr},${v})`, ok: false };
}

// ---------------------------------------------------------------------------
// Methods

export function directIntegration(c: FirstOrderCtx): MethodResult | null {
  const { f, d } = c;
  if (dependsOn(f, 'y', XY)) return null;
  const I = intOrSymbolic(f, 'x');
  const Y = simplify(`${I.r}+C`, ['x', 'C']);
  return {
    id: 'direct',
    name: 'Direct integration',
    why: `The right-hand side depends only on ${d.i('x')}, so we can integrate directly.`,
    constants: ['C'],
    steps: [
      {
        title: 'Recognize the form',
        text: `The equation has the form ${'$' + d.dydx + ' = g(' + d.x + ')$'}: the derivative is a known function of ${d.i('x')} alone. Solving it is the same as finding an antiderivative.`,
        math: [`${d.dydx} = ${d.t(f)}`],
      },
      {
        title: 'Integrate both sides',
        text: `Integrate with respect to ${d.i('x')}, adding one arbitrary constant $C$.`,
        math: [`${d.y} = \\int ${d.t(f)} \\, d${d.x} = ${d.t(Y)}`],
      },
    ],
    general: { kind: 'explicit', exprs: [Y] },
  };
}

export function separable(c: FirstOrderCtx): MethodResult | null {
  const { f, d } = c;
  if (!dependsOn(f, 'y', XY)) return null;
  const sp = separate(f);
  if (!sp) return null;
  const { g, h } = sp;
  const steps: Step[] = [];
  steps.push({
    title: 'Check that the equation is separable',
    text: `An equation is separable when the right-hand side factors into a function of ${d.i('x')} times a function of ${d.i('y')}. Here`,
    math: [`${d.dydx} = ${d.t(f)} = \\underbrace{${d.t(g)}}_{g(${d.x})} \\cdot \\underbrace{${d.t(h)}}_{h(${d.y})}`],
  });
  const invh = simplify(`1/(${h})`, XY);
  steps.push({
    title: 'Separate the variables',
    text: `Treat ${'$' + d.dydx + '$'} like a fraction: divide both sides by ${d.i(h)} and multiply by ${'$d' + d.x + '$'}, so every ${d.i('y')} is on the left and every ${d.i('x')} is on the right.`,
    math: [`${d.t(invh)} \\, d${d.y} = ${d.t(g)} \\, d${d.x}`],
  });
  const H = intOrSymbolic(invh, 'y');
  const G = intOrSymbolic(g, 'x');
  steps.push({
    title: 'Integrate both sides',
    text: `Integrate the left side with respect to ${d.i('y')} and the right side with respect to ${d.i('x')}. Both constants of integration combine into a single constant $C$ on the right.` +
      (/log\(/.test(H.r) ? ' (Here $\\ln$ means $\\ln|\\cdot|$; the absolute value is absorbed into the constant later.)' : ''),
    math: [`\\int ${d.t(invh)} \\, d${d.y} = \\int ${d.t(g)} \\, d${d.x}`, `${d.t(H.r)} = ${d.t(G.r)} + C`],
  });
  let general: GeneralSolution;
  if (H.ok && G.ok) general = solveForY(H.r, G.r, d, 'y', f, steps);
  else general = { kind: 'implicit', lhs: simplify(`(${H.r})-(${G.r})`, XY), rhs: 'C' };

  // equilibrium solutions: h(y) = 0
  const singular: { expr: string; note: string }[] = [];
  if (symbols(h).has('y')) {
    const roots = solve(h, 'y').filter((r) => symbols(r).size === 0 || [...symbols(r)].every((s) => !['x', 'y'].includes(s))).filter((r) => !/\bi\b/.test(r));
    for (const r of roots.slice(0, 4)) {
      const rr = simplify(r, XY);
      let note = `Dividing by ${d.i(h)} assumed it was nonzero. The constant function ${d.i(`y`)}$\\,=\\,${d.t(rr)}$ makes it zero and also solves the equation (an equilibrium solution).`;
      if (general.kind === 'explicit' && general.exprs.some((Y) => numEqual(subs(Y, { C: '0' }), rr, ['x']))) note += ' It is included in the general solution with $C = 0$.';
      singular.push({ expr: rr, note });
    }
  }
  if (singular.length) {
    steps.push({
      title: 'Don\'t lose equilibrium solutions',
      text: singular.map((s) => s.note).join(' '),
    });
  }
  return {
    id: 'separable',
    name: 'Separation of variables',
    why: `The right-hand side factors as ${d.i(g)} times ${d.i(h)}.`,
    constants: ['C'],
    steps,
    general,
    singular,
  };
}

/** Pieces of a linear equation y' + P y = Q, or null. */
export function linearParts(f: string): { P: string; Q: string } | null {
  if (!dependsOn(f, 'y', XY)) return null;
  let fy: string;
  try {
    fy = diff(f, 'y');
  } catch {
    return null;
  }
  if (dependsOn(fy, 'y', XY)) return null;
  const P = simplify(`-(${symbols(fy).has('y') ? subs(fy, { y: '1' }) : fy})`, XY);
  const Q = simplify(subs(f, { y: '0' }), XY);
  if (!numEqual(`-(${P})*y+(${Q})`, f, XY)) return null;
  return { P, Q };
}

/**
 * Integrating-factor solution of y' + P y = Q (in internal x, y).
 * Returns steps and the explicit solution.
 */
export function solveLinearSteps(P: string, Q: string, d: Disp): { steps: Step[]; Y: string } {
  const steps: Step[] = [];
  const IP = intOrSymbolic(P, 'x');
  const mu = IP.ok ? simplify(expLog(`e^(${IP.r})`), ['x']) : `e^(${IP.r})`;
  steps.push({
    title: 'Find the integrating factor',
    text: `Multiply by ${'$\\mu(' + d.x + ') = e^{\\int P(' + d.x + ')\\,d' + d.x + '}$'}. This particular choice makes the left side collapse into the derivative of a product. (Any antiderivative works, so we drop the constant of integration and absolute values.)`,
    math: [`\\int P\\,d${d.x} = \\int ${d.t(P)} \\, d${d.x} = ${d.t(IP.r)}`, `e^{${d.t(IP.r)}}` === d.t(mu) ? `\\mu(${d.x}) = ${d.t(mu)}` : `\\mu(${d.x}) = e^{${d.t(IP.r)}} = ${d.t(mu)}`],
  });
  const muQ = simplify(`(${mu})*(${Q})`, ['x']);
  steps.push({
    title: 'Multiply through and recognize a product rule',
    text: `After multiplying by ${d.i(mu)}, the left side is exactly ${'$\\frac{d}{d' + d.x + '}\\left[\\mu ' + d.y + '\\right]$'}, because ${'$\\mu\' = P\\mu$'}.`,
    math: [`\\frac{d}{d${d.x}}\\left[${d.t(`(${mu})*y`)}\\right] = ${d.t(muQ)}`],
  });
  const I = intOrSymbolic(muQ, 'x');
  steps.push({
    title: 'Integrate both sides',
    math: [`${d.t(`(${mu})*y`)} = \\int ${d.t(muQ)} \\, d${d.x} = ${d.t(I.r)} + C`],
  });
  const Y = simplify(`((${I.r})+C)/(${mu})`, ['x', 'C']);
  const Yexp = distribute(Y);
  const best = Yexp.length <= Y.length + 15 ? Yexp : Y;
  steps.push({
    title: `Solve for ${d.y}`,
    text: `Divide by the integrating factor:`,
    math: [`${d.y} = ${d.t(best)}`],
  });
  return { steps, Y: best };
}

export function linear(c: FirstOrderCtx): MethodResult | null {
  const { f, d } = c;
  const lp = linearParts(f);
  if (!lp) return null;
  const { P, Q } = lp;
  const steps: Step[] = [];
  const nIsOne = numEqual(c.N, '1', XY);
  steps.push({
    title: 'Write the equation in standard form',
    text:
      (nIsOne ? '' : `Divide every term by the coefficient of ${'$' + d.yp + '$'}, ${d.i(c.N)}. `) +
      `A first-order linear equation has the standard form ${'$' + d.yp + ' + P(' + d.x + ')\\,' + d.y + ' = Q(' + d.x + ')$'}.`,
    math: [`${d.yp} + ${wrapP(d.t(P))}${d.y} = ${d.t(Q)}`, `P(${d.x}) = ${d.t(P)}, \\quad Q(${d.x}) = ${d.t(Q)}`],
  });
  const lin = solveLinearSteps(P, Q, d);
  steps.push(...lin.steps);
  return {
    id: 'linear',
    name: 'Integrating factor (linear equation)',
    why: `The equation is linear in ${d.i('y')}: ${'$' + d.yp + ' + P(' + d.x + ')' + d.y + ' = Q(' + d.x + ')$'}.`,
    constants: ['C'],
    steps,
    general: { kind: 'explicit', exprs: [lin.Y] },
  };
}

function wrapP(t: string): string {
  if (t === '1') return '';
  if (t === '-1') return '-';
  return /[+-]/.test(t.slice(1)) ? `\\left(${t}\\right)` : t;
}

/** Find powers of y in f: returns map n -> coefficient(x). */
function yPowers(f: string): Map<string, string> | null {
  const ex = expand(f);
  const terms = sumTermsStr(ex);
  const groups = new Map<string, string[]>();
  for (const t of terms) {
    // numeric power estimate
    const pts = samplePoints({ vars: XY, count: 6, seed: 5 });
    let k: number | null = null;
    for (const p of pts) {
      const a = evalAt(t, p);
      const b = evalAt(t, { ...p, y: p.y * 2 });
      if (Number.isNaN(a) || Number.isNaN(b) || a === 0) continue;
      const kk = Math.log(Math.abs(b / a)) / Math.LN2;
      if (b / a < 0) return null;
      if (k === null) k = kk;
      else if (Math.abs(k - kk) > 1e-6) return null;
    }
    if (k === null) return null;
    const r = rationalize(k, 50, 1e-6);
    if (!r) return null;
    const key = r[1] === 1 ? String(r[0]) : `${r[0]}/${r[1]}`;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  const out = new Map<string, string>();
  for (const [k, ts] of groups) {
    const coef = simplify(`(${ts.join('+')})/y^(${k})`, XY);
    if (dependsOn(coef, 'y', XY)) return null;
    const clean = symbols(coef).has('y') ? simplify(subs(coef, { y: '1' }), ['x']) : coef;
    out.set(k, clean);
  }
  return out;
}

export function bernoulli(c: FirstOrderCtx): MethodResult | null {
  const { f, d } = c;
  const pw = yPowers(f);
  if (!pw || pw.size !== 2 || !pw.has('1')) return null;
  const nKey = [...pw.keys()].find((k) => k !== '1')!;
  if (nKey === '0') return null;
  const n = nKey;
  const P = simplify(`-(${pw.get('1')})`, ['x']);
  const Q = pw.get(nKey)!;
  const oneMinusN = norm(`1-(${n})`);
  const steps: Step[] = [];
  steps.push({
    title: 'Recognize a Bernoulli equation',
    text: `A Bernoulli equation has the form ${'$' + d.yp + ' + P(' + d.x + ')' + d.y + ' = Q(' + d.x + ')' + d.y + '^n$'} with $n \\ne 0, 1$. It is not linear, but a substitution turns it into a linear equation.`,
    math: [`${d.yp} + ${wrapP(d.t(P))}${d.y} = ${d.t(`(${Q})*y^(${n})`)}, \\qquad n = ${d.t(n)}`],
  });
  const dv = d.with({ y: 'v' });
  steps.push({
    title: 'Substitute ' + `v = ${d.y}^{1-n}`,
    text: `Let ${'$v = ' + d.t(`y^(${oneMinusN})`) + '$'}. Then ${'$v\' = ' + d.t(oneMinusN) + '\\,' + d.t(`y^(-(${n}))`) + d.yp + '$'}. Dividing the equation by ${d.i(`y^(${n})`)} and rewriting in terms of $v$ gives a linear equation:`,
    math: [`v' + ${wrapP(d.t(simplify(`(${oneMinusN})*(${P})`, ['x'])))}v = ${d.t(simplify(`(${oneMinusN})*(${Q})`, ['x']))}`],
  });
  const P2 = simplify(`(${oneMinusN})*(${P})`, ['x']);
  const Q2 = simplify(`(${oneMinusN})*(${Q})`, ['x']);
  const lin = solveLinearSteps(P2, Q2, dv);
  steps.push({ title: 'Solve the linear equation for v', substeps: lin.steps });
  // back-substitute y^(1-n) = V
  const expo = norm(`1/(${oneMinusN})`);
  const r = rationalize(evalAt(expo, {}), 100, 1e-9);
  let exprs: string[];
  const base = simplify(`(${lin.Y})^(${expo})`, ['x', 'C']);
  if (r && r[1] % 2 === 0) exprs = [base, `-(${base})`];
  else exprs = [base];
  exprs = exprs.map((e) => simplify(e, ['x', 'C']));
  steps.push({
    title: 'Substitute back',
    text: `Since ${'$v = ' + d.t(`y^(${oneMinusN})`) + '$'}, raise both sides to the power ${d.i(expo)}:`,
    math: [`${d.t(`y^(${oneMinusN})`)} = ${d.t(lin.Y)}`, ...exprs.map((e) => `${d.y} = ${d.t(e)}`)],
  });
  const singular = evalAt(n, {}) > 0 ? [{ expr: '0', note: `${d.i('y')}$\\,=0$ is also a solution (we divided by ${d.i(`y^(${n})`)}).` }] : [];
  if (singular.length) steps.push({ title: 'The zero solution', text: singular[0].note });
  return {
    id: 'bernoulli',
    name: 'Bernoulli substitution',
    why: `The equation has the form ${'$' + d.yp + ' + P' + d.y + ' = Q' + d.y + '^{n}$'} with $n = ${d.t(n)}$.`,
    constants: ['C'],
    steps,
    general: { kind: 'explicit', exprs },
    singular,
  };
}

export function homogeneous(c: FirstOrderCtx): MethodResult | null {
  const { f, d } = c;
  if (!dependsOn(f, 'y', XY) || !dependsOn(f, 'x', XY)) return null;
  if (!numEqual(subs(f, { x: '(1.7*x)', y: '(1.7*y)' }), f, XY) || !numEqual(subs(f, { x: '(0.45*x)', y: '(0.45*y)' }), f, XY)) return null;
  const Fv = simplify(subs(f, { x: '1', y: 'v' }), ['v']);
  if (!numEqual(subs(Fv, { v: 'y/x' }), f, XY)) return null;
  const D = simplify(`(${Fv})-v`, ['v']);
  if (norm(D) === '0' || !symbols(D).has('v')) return null;
  const dv = d.with({});
  const steps: Step[] = [];
  steps.push({
    title: 'Check for a homogeneous equation',
    text: `Replacing ${d.i('x')} by ${'$t' + d.x + '$'} and ${d.i('y')} by ${'$t' + d.y + '$'} leaves the right-hand side unchanged, so it depends only on the ratio ${'$v = ' + d.y + '/' + d.x + '$'}:`,
    math: [`${d.dydx} = ${d.t(f)} = ${dv.t(Fv)}, \\qquad v = \\frac{${d.y}}{${d.x}}`],
  });
  steps.push({
    title: `Substitute ${d.y} = v${d.x}`,
    text: `With ${'$' + d.y + ' = v' + d.x + '$'}, the product rule gives ${'$' + d.dydx + ' = v + ' + d.x + '\\frac{dv}{d' + d.x + '}$'}. Substituting:`,
    math: [`v + ${d.x}\\frac{dv}{d${d.x}} = ${dv.t(Fv)}`, `${d.x}\\frac{dv}{d${d.x}} = ${dv.t(D)}`],
  });
  const inv = simplify(`1/(${D})`, ['v']);
  steps.push({
    title: 'Separate the variables',
    text: `This is now separable in $v$ and ${d.i('x')}:`,
    math: [`${dv.t(inv)}\\,dv = \\frac{d${d.x}}{${d.x}}`],
  });
  const H = intOrSymbolic(inv, 'v');
  steps.push({
    title: 'Integrate both sides',
    math: [`\\int ${dv.t(inv)}\\,dv = \\int \\frac{d${d.x}}{${d.x}}`, `${dv.t(H.r)} = \\ln ${d.x} + C`],
  });
  let general: GeneralSolution;
  if (!H.ok) {
    general = { kind: 'implicit', lhs: `(${subs(H.r, { v: 'y/x' })})-log(x)`, rhs: 'C' };
  } else {
    // Solve for v, then y = x v
    const sub2: Step[] = [];
    const g = solveForY(H.r, 'log(x)', d.with({ y: 'v' }), 'v', null, sub2);
    if (g.kind === 'explicit') {
      const ys = g.exprs.map((V) => simplify(`x*(${subs(V, {})})`, ['x', 'C'])).filter((Y) => verifyExplicit1(Y, f));
      if (ys.length) {
        steps.push(...sub2.map((s) => ({ ...s, title: s.title.replace(/Solve for .*/, 'Solve for v') })));
        steps.push({
          title: 'Substitute back',
          text: `Replace $v$ by ${'$' + d.y + '/' + d.x + '$'}, i.e. ${'$' + d.y + ' = ' + d.x + 'v$'}:`,
          math: ys.map((Y) => `${d.y} = ${d.t(Y)}`),
        });
        general = { kind: 'explicit', exprs: ys };
      } else general = backImplicit();
    } else general = backImplicit();
  }
  function backImplicit(): GeneralSolution {
    const lhs = simplify(`(${subs(H.r, { v: '(y/x)' })})-log(x)`, XY);
    steps.push({
      title: 'Substitute back',
      text: `Replace $v$ by ${'$' + d.y + '/' + d.x + '$'} to get an implicit solution:`,
      math: [`${d.t(lhs)} = C`],
    });
    return { kind: 'implicit', lhs, rhs: 'C' };
  }
  return {
    id: 'homogeneous',
    name: 'Homogeneous substitution (v = y/x)',
    why: `The right-hand side is a function of ${'$' + d.y + '/' + d.x + '$'} alone.`,
    constants: ['C'],
    steps,
    general,
  };
}

function exactCore(M: string, N: string, d: Disp, steps: Step[]): GeneralSolution | null {
  const My = simplify(diff(M, 'y'), XY);
  const Nx = simplify(diff(N, 'x'), XY);
  steps.push({
    title: 'Test for exactness',
    text: `The equation ${'$M\\,d' + d.x + ' + N\\,d' + d.y + ' = 0$'} is exact when ${'$\\partial M/\\partial ' + d.y + ' = \\partial N/\\partial ' + d.x + '$'}. Then there is a potential function $\\psi(${d.x},${d.y})$ with ${'$\\psi_{' + d.x + '} = M$'} and ${'$\\psi_{' + d.y + '} = N$'}, and the solutions are its level curves ${'$\\psi = C$'}.`,
    math: [`\\frac{\\partial M}{\\partial ${d.y}} = ${d.t(My)}, \\qquad \\frac{\\partial N}{\\partial ${d.x}} = ${d.t(Nx)} \\quad \\checkmark`],
  });
  const IM = integrate(M, 'x');
  if (!IM) return null;
  const IMs = simplify(IM, XY);
  steps.push({
    title: `Integrate M with respect to ${d.x}`,
    text: `Hold ${d.i('y')} fixed. The "constant" of integration can depend on ${d.i('y')}, so call it ${'$h(' + d.y + ')$'}.`,
    math: [`\\psi = \\int ${d.t(M)} \\, d${d.x} = ${d.t(IMs)} + h(${d.y})`],
  });
  const IMy = diff(IMs, 'y');
  let hp = simplify(`(${N})-(${IMy})`, XY);
  if (dependsOn(hp, 'x', XY)) return null;
  if (symbols(hp).has('x')) hp = simplify(subs(hp, { x: '1' }), ['y']);
  steps.push({
    title: `Find h(${d.y})`,
    text: `Differentiate with respect to ${d.i('y')} and set the result equal to $N$:`,
    math: [`${d.t(IMy)} + h'(${d.y}) = ${d.t(N)}`, `h'(${d.y}) = ${d.t(hp)}`],
  });
  const h = norm(hp) === '0' ? '0' : integrate(hp, 'y');
  if (h === null) return null;
  const hs = simplify(h, ['y']);
  const psi = simplify(`(${IMs})+(${hs})`, XY);
  steps.push({
    title: 'Write the potential function',
    math: [`h(${d.y}) = ${d.t(hs)}`, `\\psi(${d.x}, ${d.y}) = ${d.t(psi)}`],
    text: 'The solutions are the level curves of $\\psi$:',
  });
  steps.push({ title: 'Implicit solution', math: [`${d.t(psi)} = C`] });
  return { kind: 'implicit', lhs: psi, rhs: 'C' };
}

export function exact(c: FirstOrderCtx): MethodResult | null {
  const { M, N, d } = c;
  if (!dependsOn(c.f, 'y', XY)) return null;
  if (!symbols(N).has('x') && !symbols(N).has('y') && !c.differentialForm) return null; // trivial N: covered by other methods
  const My = diff(M, 'y');
  const Nx = diff(N, 'x');
  if (!numEqual(My, Nx, XY)) return null;
  const steps: Step[] = [];
  steps.push({
    title: 'Write in differential form',
    math: [`\\underbrace{${d.t(M)}}_{M}\\,d${d.x} + \\underbrace{${d.t(N)}}_{N}\\,d${d.y} = 0`],
  });
  const g = exactCore(M, N, d, steps);
  if (!g) return null;
  return {
    id: 'exact',
    name: 'Exact equation',
    why: `${'$\\partial M/\\partial ' + d.y + ' = \\partial N/\\partial ' + d.x + '$'}, so the equation is exact.`,
    constants: ['C'],
    steps,
    general: tryExplicit(g, c),
  };
}

function tryExplicit(g: GeneralSolution, c: FirstOrderCtx): GeneralSolution {
  if (g.kind !== 'implicit') return g;
  const sols = solve(`(${g.lhs})-C`, 'y').map((s) => simplify(s, ['x', 'C'])).filter(goodExplicit).filter((s) => verifyExplicit1(s, c.f));
  if (sols.length === 1 || (sols.length === 2 && sols.every((x) => x.length < 1.5 * g.lhs.length))) return { kind: 'explicit', exprs: sols };
  return g;
}

export function integratingFactorExact(c: FirstOrderCtx): MethodResult | null {
  const { M, N, d } = c;
  if (!dependsOn(c.f, 'y', XY)) return null;
  const My = diff(M, 'y');
  const Nx = diff(N, 'x');
  if (numEqual(My, Nx, XY)) return null;
  const r1 = simplify(`((${My})-(${Nx}))/(${N})`, XY);
  const r2 = simplify(`((${Nx})-(${My}))/(${M})`, XY);
  let mu: string | null = null;
  let which: 'x' | 'y' = 'x';
  let ratio = '';
  if (!dependsOn(r1, 'y', XY)) {
    const r = symbols(r1).has('y') ? simplify(subs(r1, { y: '1' }), ['x']) : r1;
    const I = integrate(r, 'x');
    if (I) {
      mu = simplify(expLog(`e^(${I})`), ['x']);
      which = 'x';
      ratio = r;
    }
  }
  if (!mu && !dependsOn(r2, 'x', XY)) {
    const r = symbols(r2).has('x') ? simplify(subs(r2, { x: '1' }), ['y']) : r2;
    const I = integrate(r, 'y');
    if (I) {
      mu = simplify(expLog(`e^(${I})`), ['y']);
      which = 'y';
      ratio = r;
    }
  }
  if (!mu) return null;
  const M2 = simplify(`(${mu})*(${M})`, XY);
  const N2 = simplify(`(${mu})*(${N})`, XY);
  const steps: Step[] = [];
  steps.push({
    title: 'The equation is not exact',
    math: [`\\underbrace{${d.t(M)}}_{M}\\,d${d.x} + \\underbrace{${d.t(N)}}_{N}\\,d${d.y} = 0`, `\\frac{\\partial M}{\\partial ${d.y}} = ${d.t(simplify(My, XY))} \\ne ${d.t(simplify(Nx, XY))} = \\frac{\\partial N}{\\partial ${d.x}}`],
  });
  steps.push({
    title: `Find an integrating factor μ(${which === 'x' ? d.x : d.y})`,
    text:
      which === 'x'
        ? `The ratio ${'$\\dfrac{M_{' + d.y + '} - N_{' + d.x + '}}{N}$'} depends only on ${d.i('x')}, so ${'$\\mu = e^{\\int (M_' + d.y + ' - N_' + d.x + ')/N\\,d' + d.x + '}$'} makes the equation exact.`
        : `The ratio ${'$\\dfrac{N_{' + d.x + '} - M_{' + d.y + '}}{M}$'} depends only on ${d.i('y')}, so ${'$\\mu = e^{\\int (N_' + d.x + ' - M_' + d.y + ')/M\\,d' + d.y + '}$'} makes the equation exact.`,
    math: [`${which === 'x' ? `\\frac{M_{${d.y}} - N_{${d.x}}}{N}` : `\\frac{N_{${d.x}} - M_{${d.y}}}{M}`} = ${d.t(ratio)}`, `\\mu = ${d.t(mu)}`],
  });
  steps.push({
    title: 'Multiply through by μ',
    math: [`${d.p(M2)}\\,d${d.x} + ${d.p(N2)}\\,d${d.y} = 0`],
  });
  const core: Step[] = [];
  const g = exactCore(M2, N2, d, core);
  if (!g) return null;
  steps.push({ title: 'Solve the exact equation', substeps: core });
  return {
    id: 'intfactor',
    name: 'Integrating factor (make it exact)',
    why: `Multiplying by ${d.i(mu)} makes the equation exact.`,
    constants: ['C'],
    steps,
    general: tryExplicit(g, c),
  };
}

export { splitTopLevel };
