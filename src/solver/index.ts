import { parseInput, InputError } from './parseInput';
import type { ParsedInput } from './parseInput';
import { numEqual, evalAt, symbols } from '../cas/math';
import { simplify, subs, solve, diff, norm, solveSystem } from '../cas/sym';
import { Disp } from './context';
import {
  directIntegration, separable, linear, bernoulli, homogeneous, exact, integratingFactorExact,
  verifyExplicit1, verifyImplicit1, linearParts,
} from './firstOrder';
import type { FirstOrderCtx } from './firstOrder';
import { solveSecondOrder, verifyExplicit2, SolverError, linear2Parts } from './secondOrder';
import type { SolveResult, SolveError, FinishedMethod, MethodResult, Step, Classification } from './types';

export type { SolveResult, SolveError, FinishedMethod, Step } from './types';

const XY = ['x', 'y'];

function firstOrderForm(p: ParsedInput): { M: string; N: string; f: string } {
  let F = p.F;
  if (p.differentialForm) {
    const M = simplify(subs(F, { DX: '1', DY: '0' }), XY);
    const N = simplify(subs(F, { DX: '0', DY: '1' }), XY);
    if (!numEqual(subs(F, { DX: '0', DY: '0' }), '0', XY) || !numEqual(subs(F, { DX: '1', DY: '1' }), `(${M})+(${N})`, XY))
      throw new InputError('In differential form, every term must contain exactly one of dx or dy, e.g. (2xy) dx + (x^2 + 1) dy = 0');
    F = `(${M})+(${N})*yp`;
  }
  const at = (v: string) => subs(F, { yp: v });
  const F0 = at('0');
  const F1 = at('1');
  const F2 = at('2');
  if (!numEqual(`(${F2})-2*(${F1})+(${F0})`, '0', XY))
    throw new SolverError("This equation is nonlinear in y' (for example it contains (y')^2). EulerLab currently handles equations that can be solved for y'.");
  const M = simplify(F0, XY);
  const N = simplify(`(${F1})-(${F0})`, XY);
  if (norm(N) === '0') throw new InputError("I couldn't find y' in the equation after simplifying.");
  const f = simplify(`-(${M})/(${N})`, XY);
  return { M, N, f };
}

function classify1(c: FirstOrderCtx, methods: MethodResult[]): Classification {
  const tags = new Set<string>();
  const lin = !!linearParts(c.f) || !symbols(c.f).has('y');
  for (const m of methods) {
    if (m.id === 'separable' || m.id === 'direct') tags.add('separable');
    if (m.id === 'exact') tags.add('exact');
    if (m.id === 'bernoulli') tags.add('Bernoulli');
    if (m.id === 'homogeneous') tags.add('homogeneous (in y/x)');
  }
  if (!symbols(c.f).has('x')) tags.add('autonomous');
  return { order: 1, linear: lin, tags: [...tags] };
}

function generalTex(m: MethodResult, d: Disp): string | null {
  const g = m.general;
  if (!g) return null;
  if (g.kind === 'explicit') return g.exprs.map((e) => `${d.y} = ${d.t(e)}`).join(', \\quad ');
  return `${d.t(g.lhs)} = ${d.t(g.rhs)}`;
}

function applyIC1(m: MethodResult, p: ParsedInput, d: Disp, f: string): { tex: string; steps: Step[]; explicit?: string[] } | null {
  const ic = p.ics.find((c) => c.order === 0);
  if (!ic || !m.general) return null;
  const x0 = ic.at;
  const y0 = ic.value;
  const steps: Step[] = [];
  if (m.general.kind === 'explicit') {
    for (const Y of m.general.exprs) {
      const atx0 = simplify(subs(Y, { x: x0 }), ['C']);
      const cs = solve(`(${atx0})-(${y0})`, 'C').filter((c) => !/\bi\b/.test(c));
      for (const cRaw of cs) {
        const cval = simplify(cRaw, []);
        if (!Number.isFinite(evalAt(cval, {})) && symbols(cval).size === 0) continue;
        const Yp = simplify(subs(Y, { C: cval }), ['x']);
        if (!numEqual(subs(Yp, { x: x0 }), y0, ['x'])) continue;
        steps.push({
          title: 'Apply the initial condition',
          text: `Substitute ${'$' + d.x + ' = ' + d.t(x0) + '$'} and ${'$' + d.y + ' = ' + d.t(y0) + '$'} into the general solution and solve for $C$:`,
          math: [`${d.t(y0)} = ${d.t(atx0)} \\quad\\Rightarrow\\quad C = ${d.t(cval)}`],
        });
        steps.push({ title: 'Solution of the initial value problem', math: [`${d.y} = ${d.t(Yp)}`] });
        return { tex: `${d.y} = ${d.t(Yp)}`, steps, explicit: [Yp] };
      }
    }
    return null;
  }
  // implicit
  const Cv = simplify(subs(m.general.lhs, { x: x0, y: y0 }), []);
  const steps2: Step[] = [
    {
      title: 'Apply the initial condition',
      text: `Substitute ${'$' + d.x + ' = ' + d.t(x0) + '$'}, ${'$' + d.y + ' = ' + d.t(y0) + '$'} to find $C$:`,
      math: [`C = ${d.t(Cv)}`],
    },
  ];
  const lhs = m.general.lhs;
  const sols = solve(`(${lhs})-(${Cv})`, 'y').map((s) => simplify(s, ['x'])).filter((s) => !/\bi\b|abs\(/.test(s) && s.length < 160);
  const good = sols.filter((s) => numEqual(subs(s, { x: x0 }), y0, ['x']) && verifyExplicit1(s, f));
  if (good.length) {
    steps2.push({ title: 'Solution of the initial value problem', text: 'Solving for the unknown and keeping the branch through the initial point:', math: [`${d.y} = ${d.t(good[0])}`] });
    return { tex: `${d.y} = ${d.t(good[0])}`, steps: steps2, explicit: [good[0]] };
  }
  steps2.push({ title: 'Solution of the initial value problem', math: [`${d.t(lhs)} = ${d.t(Cv)}`] });
  return { tex: `${d.t(lhs)} = ${d.t(Cv)}`, steps: steps2 };
}

function applyIC2(Y: string, p: ParsedInput, d: Disp): { tex: string; steps: Step[]; explicit: string[] } | null {
  const c0 = p.ics.find((c) => c.order === 0);
  const c1 = p.ics.find((c) => c.order === 1);
  if (!c0 && !c1) return null;
  const Yp = diff(Y, 'x');
  const eqs: string[] = [];
  const shown: string[] = [];
  if (c0) {
    const e = simplify(subs(Y, { x: c0.at }), ['C1', 'C2']);
    eqs.push(`${e}=${c0.value}`);
    shown.push(`${d.y}(${d.t(c0.at)}) = ${d.t(e)} = ${d.t(c0.value)}`);
  }
  if (c1) {
    const e = simplify(subs(Yp, { x: c1.at }), ['C1', 'C2']);
    eqs.push(`${e}=${c1.value}`);
    shown.push(`${d.y}'(${d.t(c1.at)}) = ${d.t(e)} = ${d.t(c1.value)}`);
  }
  if (eqs.length < 2) {
    return null;
  }
  const solved = solveSystem(eqs, ['C1', 'C2']);
  if (!solved) return null;
  const Yfinal = simplify(subs(Y, { C1: solved.C1, C2: solved.C2 }), ['x']);
  const steps: Step[] = [
    {
      title: 'Apply the initial conditions',
      text: `First differentiate the general solution: ${'$' + d.y + "' = " + d.t(simplify(Yp, ['x', 'C1', 'C2'])) + '$'}. Then substitute the initial conditions to get two equations for the two constants:`,
      math: [...shown, `C_1 = ${d.t(solved.C1)}, \\qquad C_2 = ${d.t(solved.C2)}`],
    },
    { title: 'Solution of the initial value problem', math: [`${d.y} = ${d.t(Yfinal)}`] },
  ];
  return { tex: `${d.y} = ${d.t(Yfinal)}`, steps, explicit: [Yfinal] };
}

export function solveODE(raw: string): SolveResult | SolveError {
  try {
    return solveInner(raw);
  } catch (e) {
    if (e instanceof InputError || e instanceof SolverError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: 'Something went wrong while solving this equation. Try rewriting it, or check the input for typos.' };
  }
}

function solveInner(raw: string): SolveResult | SolveError {
  const p = parseInput(raw);
  const d = new Disp(p.rename);
  const icsTex = p.ics.map((c) => `${d.y}${"'".repeat(c.order)}(${d.t(c.at)}) = ${d.t(c.value)}`);

  if (p.order === 2) {
    const methods = solveSecondOrder(p.F, d);
    const parts = linear2Parts(p.F)!;
    const fin: FinishedMethod[] = methods.map((m) => {
      const Y = m.general && m.general.kind === 'explicit' ? m.general.exprs[0] : null;
      const verified = Y ? verifyExplicit2(Y, p.F) : false;
      const ic = Y ? applyIC2(Y, p, d) : null;
      if (ic) m.steps.push(...ic.steps);
      return { ...m, generalTex: generalTex(m, d), particularTex: ic?.tex ?? null, verified, explicitFinal: ic?.explicit };
    });
    const f2 = simplify(`(${parts.g}-(${parts.b})*yp-(${parts.c})*y)/(${parts.a})`, ['x', 'y', 'yp']);
    const tags = [fin[0]?.id === 'euler' ? 'Cauchy–Euler' : 'constant coefficients', norm(parts.g) === '0' ? 'homogeneous' : 'nonhomogeneous'];
    return {
      ok: true,
      equationTex: `${d.t(`(${parts.a})*ypp+(${parts.b})*yp+(${parts.c})*y`)} = ${d.t(parts.g)}`,
      icsTex,
      classification: { order: 2, linear: true, tags },
      methods: fin,
      plot: {
        order: 2,
        f: f2,
        ics: p.ics.map((c) => ({ at: evalAt(c.at, {}), value: evalAt(c.value, {}), order: c.order })),
        curves: fin[0]?.explicitFinal ?? [],
        family: fin[0]?.general?.kind === 'explicit' ? fin[0].general.exprs[0] : null,
        constants: ['C1', 'C2'],
        rename: p.rename,
      },
    };
  }

  const { M, N, f } = firstOrderForm(p);
  const c: FirstOrderCtx = { f, M, N, differentialForm: p.differentialForm, d };
  const attempts = [directIntegration, separable, linear, exact, bernoulli, homogeneous, integratingFactorExact];
  const methods: MethodResult[] = [];
  for (const fn of attempts) {
    try {
      const r = fn(c);
      if (r) methods.push(r);
    } catch (e) {
      console.warn(fn.name, e);
    }
    if (methods.some((m) => m.id === 'direct')) break;
  }
  if (p.differentialForm) {
    const rank = (m: MethodResult) => (m.id === 'exact' ? 0 : m.id === 'intfactor' ? 1 : 2);
    methods.sort((a, b) => rank(a) - rank(b));
  }
  // integrating-factor-exact is redundant if the equation is linear
  const imaginary = (m: MethodResult) => {
    const g = m.general;
    if (!g) return false;
    const all = g.kind === 'explicit' ? g.exprs.join(' ') : g.lhs;
    return /\bi\b/.test(all);
  };
  const filtered = methods.filter(
    (m) =>
      !imaginary(m) &&
      !(m.id === 'intfactor' && !p.differentialForm && methods.some((o) => ['linear', 'separable', 'exact'].includes(o.id))),
  );
  if (!filtered.length) {
    return {
      ok: false,
      error:
        "EulerLab couldn't match this equation to a method it knows yet (separable, linear, exact, Bernoulli, homogeneous, or an integrating factor). It may need a substitution or a numerical method. The slope field below still shows how solutions behave.",
    };
  }
  const fin: FinishedMethod[] = filtered.map((m) => {
    let verified = false;
    if (m.general?.kind === 'explicit') verified = m.general.exprs.every((Y) => verifyExplicit1(Y, f));
    else if (m.general?.kind === 'implicit') verified = verifyImplicit1(m.general.lhs, f);
    const ic = applyIC1(m, p, d, f);
    if (ic) m.steps.push(...ic.steps);
    const explicitFinal = ic?.explicit ?? undefined;
    return { ...m, generalTex: generalTex(m, d), particularTex: ic?.tex ?? null, verified, explicitFinal };
  });
  const eqTex = p.differentialForm
    ? `${d.p(M)}\\,d${d.x} + ${d.p(N)}\\,d${d.y} = 0`
    : `${d.dydx} = ${d.t(f)}`;
  const best = fin.find((m) => m.general?.kind === 'explicit') ?? fin[0];
  return {
    ok: true,
    equationTex: eqTex,
    icsTex,
    classification: classify1(c, filtered),
    methods: fin,
    plot: {
      order: 1,
      f,
      ics: p.ics.map((ic) => ({ at: evalAt(ic.at, {}), value: evalAt(ic.value, {}), order: ic.order })),
      curves: best.explicitFinal ?? [],
      family: best.general?.kind === 'explicit' ? best.general.exprs[0] : null,
      constants: ['C'],
      rename: p.rename,
    },
  };
}

/** Also used by the UI to show "interpreted as" before solving. */
export function previewTex(raw: string): string | null {
  try {
    const p = parseInput(raw);
    const d = new Disp(p.rename);
    let eq: string;
    if (p.differentialForm) {
      const M = subs(p.F, { DX: '1', DY: '0' });
      const N = subs(p.F, { DX: '0', DY: '1' });
      eq = `${d.p(M)}\\,d${d.x} + ${d.p(N)}\\,d${d.y} = 0`;
    } else eq = `${d.t(p.F)} = 0`;
    const ics = p.ics.map((c) => `${d.y}${"'".repeat(c.order)}(${d.t(c.at)}) = ${d.t(c.value)}`);
    return [eq, ...ics].join(', \\quad ');
  } catch {
    return null;
  }
}
