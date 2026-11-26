import { numEqual, dependsOn, evalAt, symbols, rationalize, parse, str, samplePoints, math } from '../cas/math';
import { simplify, integrate, diff, subs, expand, norm, factor } from '../cas/sym';
import { Disp } from './context';
import type { MethodResult, Step } from './types';
import { sumTermsStr, productFactors } from './firstOrder';

const X = ['x'];

export interface SecondOrderParts {
  a: string;
  b: string;
  c: string;
  g: string;
}

export class SolverError extends Error {}

/** a(x) y'' + b(x) y' + c(x) y = g(x), or null if not linear. */
export function linear2Parts(F: string): SecondOrderParts | null {
  const vars = ['x', 'y', 'yp', 'ypp'];
  const a = simplify(diff(F, 'ypp'), vars);
  const b = simplify(diff(F, 'yp'), vars);
  const c = simplify(diff(F, 'y'), vars);
  for (const k of [a, b, c]) for (const v of ['y', 'yp', 'ypp']) if (dependsOn(k, v, vars)) return null;
  const rest = simplify(`(${F})-(${a})*ypp-(${b})*yp-(${c})*y`, vars);
  for (const v of ['y', 'yp', 'ypp']) if (dependsOn(rest, v, vars)) return null;
  const g = simplify(`-(${rest})`, X);
  return { a, b, c, g };
}

function isConst(s: string): boolean {
  return [...symbols(s)].every((v) => v === 'pi' || v === 'e');
}

function num(s: string): number {
  return evalAt(s, {});
}

function exactRat(v: number): string {
  const r = rationalize(v, 1000, 1e-10);
  if (r) return r[1] === 1 ? String(r[0]) : `${r[0]}/${r[1]}`;
  return String(+v.toPrecision(12));
}

interface Homog {
  y1: string;
  y2: string;
  yh: string;
  steps: Step[];
  /** characteristic polynomial value p(alpha + i beta) helper */
  rootMult: (alpha: number, beta: number) => number;
}

function constantCoeffHomog(a: string, b: string, c: string, d: Disp): Homog {
  const steps: Step[] = [];
  const A = num(a), B = num(b), Cc = num(c);
  const poly = norm(`(${a})*r^2+(${b})*r+(${c})`);
  const fac = factor(poly);
  const dr = d.with({});
  steps.push({
    title: 'Write the characteristic equation',
    text: `Try ${'$' + d.y + ' = e^{r' + d.x + '}$'}. Then ${'$' + d.y + "' = re^{r" + d.x + '}$'} and ${'$' + d.y + "'' = r^2e^{r" + d.x + '}$'}. Substituting and dividing by ${'$e^{r' + d.x + '} \\neq 0$'} leaves a quadratic in $r$:`,
    math: [`${dr.t(poly)} = 0`],
  });
  const D = B * B - 4 * A * Cc;
  const Dexact = norm(`(${b})^2-4*(${a})*(${c})`);
  let y1: string, y2: string, yh: string;
  const twoA = `2*(${a})`;
  if (Math.abs(D) < 1e-12) {
    const r = norm(`-(${b})/(${twoA})`);
    y1 = norm(`e^((${r})*x)`);
    y2 = norm(`x*e^((${r})*x)`);
    yh = norm(`(C1+C2*x)*e^((${r})*x)`);
    steps.push({
      title: 'Solve: a repeated root',
      text: `The discriminant is ${'$b^2 - 4ac = 0$'}, so there is one repeated root. That gives only one exponential solution ${'$e^{r' + d.x + '}$'}; the second independent solution is ${'$' + d.x + 'e^{r' + d.x + '}$'}.`,
      math: [fac !== poly && fac.includes('(') ? `${dr.t(fac)} = 0` : `b^2 - 4ac = ${d.t(Dexact)}`, `r = ${d.t(r)} \\text{ (double root)}`],
    });
  } else if (D > 0) {
    const r1 = simplify(`(-(${b})+sqrt(${Dexact}))/(${twoA})`, X);
    const r2 = simplify(`(-(${b})-sqrt(${Dexact}))/(${twoA})`, X);
    y1 = norm(`e^((${r1})*x)`);
    y2 = norm(`e^((${r2})*x)`);
    yh = norm(`C1*e^((${r1})*x)+C2*e^((${r2})*x)`);
    steps.push({
      title: 'Solve: two distinct real roots',
      text: `The discriminant ${'$b^2 - 4ac = ' + d.t(Dexact) + '$'} is positive, so there are two real roots, each giving an exponential solution.`,
      math: [...(/\)\*\(/.test(fac) ? [`${dr.t(fac)} = 0`] : []), `r_1 = ${d.t(r1)}, \\qquad r_2 = ${d.t(r2)}`],
    });
  } else {
    const al = norm(`-(${b})/(${twoA})`);
    const be = simplify(`sqrt(-(${Dexact}))/abs(${twoA})`, X);
    const bx = norm(`(${be})*x`);
    y1 = norm(`e^((${al})*x)*cos(${bx})`);
    y2 = norm(`e^((${al})*x)*sin(${bx})`);
    yh = norm(al === '0' ? `C1*cos(${bx})+C2*sin(${bx})` : `e^((${al})*x)*(C1*cos(${bx})+C2*sin(${bx}))`);
    steps.push({
      title: 'Solve: complex roots',
      text: `The discriminant ${'$b^2 - 4ac = ' + d.t(Dexact) + '$'} is negative, so the roots are complex: ${'$r = \\alpha \\pm \\beta i$'}. By Euler's formula, ${'$e^{(\\alpha \\pm \\beta i)' + d.x + '}$'} combine into the real solutions ${'$e^{\\alpha ' + d.x + '}\\cos \\beta ' + d.x + '$'} and ${'$e^{\\alpha ' + d.x + '}\\sin \\beta ' + d.x + '$'}.`,
      math: [`r = ${d.t(al)} \\pm ${d.t(be) === '1' ? '' : d.t(be)}i, \\qquad \\alpha = ${d.t(al)}, \\ \\beta = ${d.t(be)}`],
    });
  }
  steps.push({
    title: 'Homogeneous solution',
    text: 'Any combination of the two independent solutions solves the homogeneous equation:',
    math: [`${d.y}_h = ${d.t(yh)}`],
  });
  const rootMult = (alpha: number, beta: number) => {
    const re = A * (alpha * alpha - beta * beta) + B * alpha + Cc;
    const im = A * 2 * alpha * beta + B * beta;
    if (Math.abs(re) > 1e-9 || Math.abs(im) > 1e-9) return 0;
    const dre = 2 * A * alpha + B;
    const dim = 2 * A * beta;
    if (Math.abs(dre) < 1e-9 && Math.abs(dim) < 1e-9) return 2;
    return 1;
  };
  return { y1, y2, yh, steps, rootMult };
}

function eulerHomog(alpha: string, beta: string, gamma: string, d: Disp): Homog {
  const steps: Step[] = [];
  const A = num(alpha), B = num(beta), G = num(gamma);
  const poly = norm(`(${alpha})*r^2+((${beta})-(${alpha}))*r+(${gamma})`);
  steps.push({
    title: 'Try a power function',
    text: `For a Cauchy–Euler equation ${'$a' + d.x + '^2' + d.y + "'' + b" + d.x + d.y + "' + c" + d.y + ' = 0$'}, try ${'$' + d.y + ' = ' + d.x + '^r$'}. Each term becomes a multiple of ${'$' + d.x + '^r$'}, leaving the indicial equation ${'$ar(r-1) + br + c = 0$'}:`,
    math: [`${d.with({}).t(poly)} = 0`],
  });
  const a2 = A, b2 = B - A, c2 = G;
  const D = b2 * b2 - 4 * a2 * c2;
  const Dexact = norm(`((${beta})-(${alpha}))^2-4*(${alpha})*(${gamma})`);
  let y1: string, y2: string, yh: string;
  if (Math.abs(D) < 1e-12) {
    const r = norm(`-((${beta})-(${alpha}))/(2*(${alpha}))`);
    y1 = norm(`x^(${r})`);
    y2 = norm(`x^(${r})*log(x)`);
    yh = norm(`x^(${r})*(C1+C2*log(x))`);
    steps.push({ title: 'Repeated root', text: `A double root $r$ gives ${'$' + d.x + '^r$'} and ${'$' + d.x + '^r\\ln ' + d.x + '$'}.`, math: [`r = ${d.t(r)}`] });
  } else if (D > 0) {
    const r1 = simplify(`(-((${beta})-(${alpha}))+sqrt(${Dexact}))/(2*(${alpha}))`, X);
    const r2 = simplify(`(-((${beta})-(${alpha}))-sqrt(${Dexact}))/(2*(${alpha}))`, X);
    y1 = norm(`x^(${r1})`);
    y2 = norm(`x^(${r2})`);
    yh = norm(`C1*x^(${r1})+C2*x^(${r2})`);
    steps.push({ title: 'Two real roots', math: [`r_1 = ${d.t(r1)}, \\qquad r_2 = ${d.t(r2)}`] });
  } else {
    const al = norm(`-((${beta})-(${alpha}))/(2*(${alpha}))`);
    const be = simplify(`sqrt(-(${Dexact}))/abs(2*(${alpha}))`, X);
    y1 = norm(`x^(${al})*cos((${be})*log(x))`);
    y2 = norm(`x^(${al})*sin((${be})*log(x))`);
    yh = norm(`x^(${al})*(C1*cos((${be})*log(x))+C2*sin((${be})*log(x)))`);
    steps.push({ title: 'Complex roots', text: `Roots ${'$\\alpha \\pm \\beta i$'} give ${'$' + d.x + '^\\alpha\\cos(\\beta\\ln ' + d.x + ')$'} and ${'$' + d.x + '^\\alpha\\sin(\\beta\\ln ' + d.x + ')$'}.`, math: [`r = ${d.t(al)} \\pm ${d.t(be)}i`] });
  }
  steps.push({ title: 'Homogeneous solution', text: `Valid for ${'$' + d.x + ' > 0$'}:`, math: [`${d.y}_h = ${d.t(yh)}`] });
  return { y1, y2, yh, steps, rootMult: () => 0 };
}

// ---------------------------------------------------------------------------
// Undetermined coefficients

interface TermClass {
  alpha: number;
  beta: number;
  deg: number;
}

function classifyForcing(g: string): TermClass[] | null {
  const terms = sumTermsStr(expand(g));
  const classes: TermClass[] = [];
  for (const t of terms) {
    let alpha = 0, beta = 0, deg = 0;
    for (const { node, inv } of productFactors(parse(t))) {
      const s = str(node);
      if (isConst(s)) continue;
      if (inv) return null;
      const n = node as any;
      if (n.type === 'SymbolNode' && n.name === 'x') {
        deg += 1;
        continue;
      }
      if (n.type === 'OperatorNode' && n.fn === 'pow') {
        const base = str(n.args[0]);
        const ex = str(n.args[1]);
        if (base === 'x' && isConst(ex)) {
          const k = num(ex);
          if (!Number.isInteger(k) || k < 0) return null;
          deg += k;
          continue;
        }
        if (base === 'e') {
          const lin = linCoef(ex);
          if (lin === null) return null;
          alpha += lin;
          continue;
        }
        return null;
      }
      if (n.type === 'FunctionNode' && (n.fn.name === 'sin' || n.fn.name === 'cos')) {
        if (beta !== 0) return null; // products of trig functions
        const lin = linCoef(str(n.args[0]));
        if (lin === null || lin === 0) return null;
        beta = Math.abs(lin);
        continue;
      }
      if (n.type === 'FunctionNode' && n.fn.name === 'exp') {
        const lin = linCoef(str(n.args[0]));
        if (lin === null) return null;
        alpha += lin;
        continue;
      }
      return null;
    }
    classes.push({ alpha, beta, deg });
  }
  // merge
  const out: TermClass[] = [];
  for (const c of classes) {
    const ex = out.find((o) => Math.abs(o.alpha - c.alpha) < 1e-12 && Math.abs(o.beta - c.beta) < 1e-12);
    if (ex) ex.deg = Math.max(ex.deg, c.deg);
    else out.push({ ...c });
  }
  return out;
}

/** If expr = k*x + const, return k; else null. */
function linCoef(expr: string): number | null {
  const d1 = diff(expr, 'x');
  if (!isConst(d1)) return null;
  return num(d1);
}

const LETTERS = ['A', 'B', 'D', 'E', 'G', 'H', 'J', 'L', 'M', 'Q', 'R', 'S', 'U', 'W'];

function L(a: string, b: string, c: string, y: string): string {
  return `(${a})*(${diff(diff(y, 'x'), 'x')})+(${b})*(${diff(y, 'x')})+(${c})*(${y})`;
}

function undeterminedCoefficients(p: SecondOrderParts, h: Homog, d: Disp): { steps: Step[]; yp: string } | null {
  const classes = classifyForcing(p.g);
  if (!classes) return null;
  const basis: string[] = [];
  const trialParts: string[] = [];
  const notes: string[] = [];
  let li = 0;
  for (const cl of classes) {
    const s = h.rootMult(cl.alpha, cl.beta);
    const ax = exactRat(cl.alpha);
    const bx = exactRat(cl.beta);
    const ex = cl.alpha !== 0 ? `e^((${ax})*x)` : '1';
    const fns = cl.beta !== 0 ? [`cos((${bx})*x)`, `sin((${bx})*x)`] : ['1'];
    const groupTerms: string[] = [];
    for (const fn of fns) {
      const polyTerms: string[] = [];
      for (let k = 0; k <= cl.deg; k++) {
        const letter = LETTERS[li++] ?? `K${li}`;
        const phi = norm(`x^(${k + s})*(${ex})*(${fn})`);
        basis.push(phi);
        polyTerms.push(`${letter}*x^(${k})`);
      }
      groupTerms.push(`(${polyTerms.join('+')})*(${fn})`);
    }
    trialParts.push(norm(`x^(${s})*(${ex})*(${groupTerms.join('+')})`));
    if (s > 0) {
      const root = cl.beta !== 0 ? `${ax} \\pm ${bx}i` : ax;
      notes.push(`Because $r = ${root}$ is ${s === 2 ? 'a double' : 'a'} root of the characteristic equation, the natural guess would duplicate a homogeneous solution, so we multiply it by ${'$' + d.x + (s === 2 ? '^2' : '') + '$'}.`);
    }
  }
  if (basis.length > LETTERS.length) return null;
  const letters = LETTERS.slice(0, basis.length);
  const trial = trialParts.join('+');

  // numeric least squares for coefficients
  const Lphi = basis.map((phi) => L(p.a, p.b, p.c, phi));
  const pts = samplePoints({ vars: ['x'], count: basis.length + 6, lo: -1.2, hi: 1.3, seed: 42 });
  const rows: number[][] = [];
  const rhs: number[] = [];
  for (const pt of pts) {
    const row = Lphi.map((e) => evalAt(e, pt));
    const gv = evalAt(p.g, pt);
    if (row.some(Number.isNaN) || Number.isNaN(gv)) continue;
    rows.push(row);
    rhs.push(gv);
  }
  if (rows.length < basis.length) return null;
  // normal equations
  const At = math.transpose(rows) as number[][];
  const AtA = math.multiply(At, rows) as number[][];
  const Atb = math.multiply(At, rhs) as number[];
  let sol: number[];
  try {
    sol = (math.lusolve(AtA, Atb) as number[][]).map((r) => r[0]);
  } catch {
    return null;
  }
  const coefs = sol.map((v) => exactRat(v));
  const yp = simplify(basis.map((phi, i) => `(${coefs[i]})*(${phi})`).join('+'), X);
  if (!numEqual(L(p.a, p.b, p.c, yp), p.g, X, { lo: -1, hi: 1.5 })) return null;

  const steps: Step[] = [];
  steps.push({
    title: 'Guess the form of a particular solution',
    text:
      `The forcing term ${d.i(p.g)} is built from polynomials, exponentials, sines and cosines, so the method of undetermined coefficients applies: guess a particular solution of the same shape with unknown coefficients. ` +
      notes.join(' '),
    math: [`${d.y}_p = ${d.t(trial)}`],
  });
  const lhs = expand(L(p.a, p.b, p.c, trial));
  steps.push({
    title: 'Substitute and match coefficients',
    text: `Compute ${'$' + d.y + "_p'$"} and ${'$' + d.y + "_p''$"}, substitute into the left side, and collect like terms. Matching coefficients with the right side gives a linear system for the unknowns:`,
    math: [
      `${simplifyTexLong(d.t(simplify(lhs, ['x', ...letters])))} = ${d.t(p.g)}`,
      letters.map((l, i) => `${l} = ${d.t(coefs[i])}`).join(', \\quad '),
    ],
  });
  steps.push({ title: 'Particular solution', math: [`${d.y}_p = ${d.t(yp)}`] });
  return { steps, yp };
}

function simplifyTexLong(t: string): string {
  return t;
}

function variationOfParameters(p: SecondOrderParts, h: Homog, d: Disp): { steps: Step[]; yp: string } {
  const { y1, y2 } = h;
  const W = simplify(`(${y1})*(${diff(y2, 'x')})-(${diff(y1, 'x')})*(${y2})`, X);
  const G = simplify(`(${p.g})/(${p.a})`, X);
  const u1p = simplify(`-(${y2})*(${G})/(${W})`, X);
  const u2p = simplify(`(${y1})*(${G})/(${W})`, X);
  const u1 = integrate(u1p, 'x');
  const u2 = integrate(u2p, 'x');
  const steps: Step[] = [];
  steps.push({
    title: 'Use variation of parameters',
    text: `The forcing term ${d.i(p.g)} is not of a form that undetermined coefficients can handle, so we use variation of parameters. Look for ${'$' + d.y + '_p = u_1' + d.y + '_1 + u_2' + d.y + '_2$'} where ${'$' + d.y + '_1, ' + d.y + '_2$'} are the homogeneous solutions, and the standard-form right side is ${'$G(' + d.x + ') = ' + d.t(G) + '$'}.`,
    math: [`${d.y}_1 = ${d.t(y1)}, \\qquad ${d.y}_2 = ${d.t(y2)}`],
  });
  steps.push({
    title: 'Compute the Wronskian',
    math: [`W = ${d.y}_1${d.y}_2' - ${d.y}_1'${d.y}_2 = ${d.t(W)}`],
  });
  steps.push({
    title: `Find u₁ and u₂`,
    text: `They satisfy ${'$u_1\' = -' + d.y + '_2 G/W$'} and ${'$u_2\' = ' + d.y + '_1 G/W$'}. Integrate each (no constants needed):`,
    math: [
      `u_1' = ${d.t(u1p)} \\quad\\Rightarrow\\quad u_1 = ${u1 ? d.t(simplify(u1, X)) : `\\int ${d.t(u1p)}\\,d${d.x}`}`,
      `u_2' = ${d.t(u2p)} \\quad\\Rightarrow\\quad u_2 = ${u2 ? d.t(simplify(u2, X)) : `\\int ${d.t(u2p)}\\,d${d.x}`}`,
    ],
  });
  const U1 = u1 ? simplify(u1, X) : `integrate(${u1p},x)`;
  const U2 = u2 ? simplify(u2, X) : `integrate(${u2p},x)`;
  const yp = u1 && u2 ? simplify(`(${U1})*(${y1})+(${U2})*(${y2})`, X) : `(${U1})*(${y1})+(${U2})*(${y2})`;
  steps.push({ title: 'Particular solution', math: [`${d.y}_p = u_1${d.y}_1 + u_2${d.y}_2 = ${d.t(yp)}`] });
  return { steps, yp };
}

export function solveSecondOrder(F: string, d: Disp): MethodResult[] {
  const p = linear2Parts(F);
  if (!p) throw new SolverError('This second-order equation is not linear. EulerLab currently solves linear second-order equations with constant coefficients, and Cauchy–Euler equations.');
  const results: MethodResult[] = [];
  const isCC = isConst(p.a) && isConst(p.b) && isConst(p.c);
  const hasParams = [p.a, p.b, p.c].some((k) => [...symbols(k)].some((s) => s !== 'x' && s !== 'pi' && s !== 'e'));
  if (hasParams) throw new SolverError('For second-order equations, the coefficients need to be numbers (for example y\'\' + 4y = 0 rather than y\'\' + ky = 0).');

  const homogeneousEq = norm(p.g) === '0';
  const intro: Step = {
    title: 'Identify the equation',
    text: homogeneousEq
      ? 'This is a homogeneous linear second-order equation. Its general solution is a combination of two independent solutions.'
      : `This is a nonhomogeneous linear equation. Its general solution is ${'$' + d.y + ' = ' + d.y + '_h + ' + d.y + '_p$'}: the general solution of the homogeneous equation (right side set to zero) plus any one particular solution.`,
    math: [`${d.t(`(${p.a})*ypp+(${p.b})*yp+(${p.c})*y`)} = ${d.t(p.g)}`],
  };

  let h: Homog | null = null;
  let name = '';
  let id = '';
  let why = '';
  if (isCC) {
    h = constantCoeffHomog(p.a, p.b, p.c, d);
    name = 'Constant coefficients (characteristic equation)';
    id = 'constcoef';
    why = 'Linear with constant coefficients.';
  } else {
    // Cauchy-Euler: a = alpha x^2, b = beta x, c = gamma
    const al = simplify(`(${p.a})/x^2`, X);
    const be = simplify(`(${p.b})/x`, X);
    if (isConst(al) && isConst(be) && isConst(p.c) && !dependsOn(al, 'x', X)) {
      h = eulerHomog(al, be, p.c, d);
      name = 'Cauchy–Euler equation';
      id = 'euler';
      why = `Coefficients are ${'$a' + d.x + '^2, b' + d.x + ', c$'}.`;
    }
  }
  if (!h) throw new SolverError('EulerLab can solve second-order linear equations with constant coefficients and Cauchy–Euler equations so far. Variable-coefficient equations like this one are coming later.');

  const steps: Step[] = [intro, { title: 'Solve the homogeneous equation', substeps: h.steps }];
  let yfull = h.yh;
  if (!homogeneousEq) {
    let part = isCC ? undeterminedCoefficients(p, h, d) : null;
    let partName = 'Undetermined coefficients';
    if (!part) {
      part = variationOfParameters(p, h, d);
      partName = 'Variation of parameters';
    }
    steps.push({ title: `Find a particular solution (${partName.toLowerCase()})`, substeps: part.steps });
    yfull = `(${h.yh})+(${part.yp})`;
    if (results.length === 0) name = name + ' + ' + partName.toLowerCase();
  }
  const Y = norm(yfull);
  steps.push({
    title: 'General solution',
    text: homogeneousEq ? undefined : `Add the homogeneous and particular solutions:`,
    math: [`${d.y} = ${d.t(Y)}`],
  });
  results.push({ id, name, why, constants: ['C1', 'C2'], steps, general: { kind: 'explicit', exprs: [Y] } });
  return results;
}

export function verifyExplicit2(Y: string, F: string): boolean {
  try {
    const Yp = diff(Y, 'x');
    const Ypp = diff(Yp, 'x');
    const r = subs(F, { y: Y, yp: Yp, ypp: Ypp });
    return numEqual(r, '0', ['x', 'C1', 'C2'], { count: 30, lo: 0.3, hi: 1.8 });
  } catch {
    return false;
  }
}
