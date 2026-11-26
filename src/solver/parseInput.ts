/**
 * Turns what a learner types ("y' + 2y = e^x, y(0)=1", "dy/dx = xy",
 * "(2xy)dx + x^2 dy = 0", "x'' + 4x = 0") into internal expression strings
 * over the canonical names x (independent), y (dependent), yp = y', ypp = y''.
 */
import { parse, str, FUNCTIONS } from '../cas/math';

export class InputError extends Error {}

export interface ParsedInput {
  /** lhs - rhs of the equation, in internal names. */
  F: string;
  order: number;
  /** true if written as M dx + N dy = 0 */
  differentialForm: boolean;
  dep: string;
  indep: string;
  ics: InitialCondition[];
  /** display names for internal symbols */
  rename: Record<string, string>;
}

export interface InitialCondition {
  order: number; // 0 for y(x0)=y0, 1 for y'(x0)=...
  at: string;
  value: string;
}

const FN_ALIASES: Record<string, string> = {
  ln: 'log',
  arcsin: 'asin',
  arccos: 'acos',
  arctan: 'atan',
  arcsec: 'asec',
  arccsc: 'acsc',
  arccot: 'acot',
};

const GREEK = [
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'theta', 'kappa', 'lambda', 'mu', 'nu', 'xi',
  'rho', 'sigma', 'tau', 'phi', 'chi', 'psi', 'omega',
];

const WORDS = [...FUNCTIONS, ...Object.keys(FN_ALIASES), ...GREEK, 'pi'].sort((a, b) => b.length - a.length);

type Tok =
  | { t: 'num'; v: string }
  | { t: 'id'; v: string }
  | { t: 'fn'; v: string }
  | { t: 'op'; v: string }
  | { t: '('; } | { t: ')'; }
  | { t: '|' }
  | { t: 'der'; v: string; n: number; wrt?: string }
  | { t: 'diff'; v: string };

function normalizeUnicode(s: string): string {
  return s
    .replace(/[′’‘`´]/g, "'")
    .replace(/″/g, "''")
    .replace(/‴/g, "'''")
    .replace(/[·×∙⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/π/g, 'pi')
    .replace(/θ/g, 'theta')
    .replace(/λ/g, 'lambda')
    .replace(/ω/g, 'omega')
    .replace(/α/g, 'alpha')
    .replace(/β/g, 'beta')
    .replace(/μ/g, 'mu')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√/g, 'sqrt')
    .replace(/\*\*/g, '^')
    .replace(/[\[{]/g, '(')
    .replace(/[\]}]/g, ')');
}

function tokenize(src: string): Tok[] {
  const s = src;
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const rest = s.slice(i);
    // Leibniz notation: d^2y/dx^2, d2y/dx2, d²y/dx²
    let m = /^d\s*\^?\s*\(?\s*([2-9])\s*\)?\s*([A-Za-z])\s*\/\s*d\s*([A-Za-z])\s*(\^?\s*\(?\s*[2-9]\s*\)?)?/.exec(rest);
    if (m && m[4]) {
      toks.push({ t: 'der', v: m[2], n: Number(m[1]), wrt: m[3] });
      i += m[0].length;
      continue;
    }
    m = /^d\s*([A-Za-z])\s*\/\s*d\s*([A-Za-z])(?![A-Za-z(])/.exec(rest);
    if (m) {
      toks.push({ t: 'der', v: m[1], n: 1, wrt: m[2] });
      i += m[0].length;
      continue;
    }
    // differentials dx, dy (not followed by more letters)
    m = /^d([A-Za-z])(?![A-Za-z'])/.exec(rest);
    if (m && (i === 0 || !/[A-Za-z]/.test(s[i - 1]))) {
      toks.push({ t: 'diff', v: m[1] });
      i += m[0].length;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const n = /^\d*\.?\d+/.exec(rest) ?? /^\d+\.?/.exec(rest);
      if (!n) throw new InputError(`Unexpected "${ch}"`);
      toks.push({ t: 'num', v: n[0] });
      i += n[0].length;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      const run = /^[A-Za-z]+/.exec(rest)![0];
      let j = 0;
      while (j < run.length) {
        const sub = run.slice(j);
        const w = WORDS.find((w) => sub.startsWith(w));
        if (w) {
          const name = FN_ALIASES[w] ?? w;
          if (FUNCTIONS.has(name)) toks.push({ t: 'fn', v: name });
          else toks.push({ t: 'id', v: name });
          j += w.length;
        } else {
          toks.push({ t: 'id', v: sub[0] });
          j++;
        }
      }
      i += run.length;
      // primes attach to the last identifier
      let primes = 0;
      while (s[i + primes] === "'") primes++;
      if (primes) {
        const last = toks.pop()!;
        if (last.t !== 'id') throw new InputError('A prime (\') must follow a variable, like y\'');
        toks.push({ t: 'der', v: last.v, n: primes });
        i += primes;
      }
      continue;
    }
    if ('+-*/^='.includes(ch)) {
      toks.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    if (ch === '(') {
      toks.push({ t: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      toks.push({ t: ')' });
      i++;
      continue;
    }
    if (ch === '|') {
      toks.push({ t: '|' });
      i++;
      continue;
    }
    if (ch === "'") throw new InputError("A prime (') must follow a variable, like y'");
    throw new InputError(`I don't understand the character "${ch}"`);
  }
  return toks;
}

interface Ctx {
  dep: string;
  indep: string;
}

function isValueEnd(t: Tok | undefined): boolean {
  if (!t) return false;
  return t.t === 'num' || t.t === 'id' || t.t === ')' || t.t === 'der' || t.t === 'diff';
}
function isValueStart(t: Tok | undefined): boolean {
  if (!t) return false;
  return t.t === 'num' || t.t === 'id' || t.t === '(' || t.t === 'fn' || t.t === 'der' || t.t === 'diff';
}

function symName(t: Tok, ctx: Ctx): string {
  if (t.t === 'der') {
    if (t.v !== ctx.dep) throw new InputError(`Derivative of "${t.v}" found, but the unknown function is "${ctx.dep}"`);
    if (t.n === 1) return 'yp';
    if (t.n === 2) return 'ypp';
    throw new InputError('Equations of order 3 or higher are not supported yet');
  }
  if (t.t === 'diff') {
    if (t.v === ctx.indep) return 'DX';
    if (t.v === ctx.dep) return 'DY';
    throw new InputError(`Unexpected differential d${t.v}`);
  }
  if (t.t === 'id') {
    if (t.v === ctx.dep) return 'y';
    if (t.v === ctx.indep) return 'x';
    if (t.v === 'x' || t.v === 'y') return `${t.v}_`; // conflicting letter used as a constant
    if (t.v === 'C') return 'K'; // keep C free for integration constants
    return t.v;
  }
  throw new Error('bad token');
}

/** Convert tokens to an explicit expression string. */
function emit(toks: Tok[], ctx: Ctx): string {
  let out = '';
  let i = 0;
  const absStack: number[] = [];
  let depth = 0;
  let prev: Tok | undefined;

  const push = (s: string, t: Tok) => {
    if (isValueEnd(prev) && isValueStart(t)) out += '*';
    out += s;
    prev = t;
  };

  // Read the argument of a function written without parentheses: sin x, sin 2x, ln x^2
  const readBareArg = (): string => {
    let arg = '';
    let p: Tok | undefined;
    while (i < toks.length) {
      const t = toks[i];
      if (t.t === 'num' || t.t === 'id' || t.t === 'der') {
        if (isValueEnd(p)) arg += '*';
        arg += t.t === 'num' ? t.v : symName(t, ctx);
        p = t;
        i++;
        if (toks[i]?.t === 'op' && (toks[i] as { v: string }).v === '^') {
          // exponent: a single atom or parenthesized group
          arg += '^';
          i++;
          arg += readAtom();
        }
      } else break;
    }
    if (!arg) throw new InputError('A function is missing its argument');
    return arg;
  };

  const readAtom = (): string => {
    const t = toks[i];
    if (!t) throw new InputError('Expression ends unexpectedly');
    if (t.t === 'op' && t.v === '-') {
      i++;
      return `(-${readAtom()})`;
    }
    if (t.t === 'num') {
      i++;
      return t.v;
    }
    if (t.t === 'id' || t.t === 'der') {
      i++;
      return symName(t, ctx);
    }
    if (t.t === '(') {
      let d = 0;
      const start = i;
      for (; i < toks.length; i++) {
        if (toks[i].t === '(') d++;
        if (toks[i].t === ')') d--;
        if (d === 0) break;
      }
      const inner = toks.slice(start + 1, i);
      i++;
      return `(${emit(inner, ctx)})`;
    }
    throw new InputError('Could not read exponent');
  };

  while (i < toks.length) {
    const t = toks[i];
    switch (t.t) {
      case 'num':
        push(t.v, t);
        i++;
        break;
      case 'id':
      case 'der':
      case 'diff':
        push(symName(t, ctx), t);
        i++;
        break;
      case 'op':
        out += t.v;
        prev = t;
        i++;
        break;
      case '(':
        push('(', t);
        depth++;
        i++;
        break;
      case ')':
        out += ')';
        depth--;
        prev = t;
        i++;
        break;
      case '|': {
        const opening = !isValueEnd(prev) || (absStack.length > 0 && absStack[absStack.length - 1] < depth ? false : !absStack.length);
        if (opening && !(absStack.length && isValueEnd(prev))) {
          push('abs(', { t: '(' });
          absStack.push(depth);
          depth++;
        } else {
          out += ')';
          absStack.pop();
          depth--;
          prev = { t: ')' };
        }
        i++;
        break;
      }
      case 'fn': {
        const name = t.v;
        i++;
        let power = '';
        if (toks[i]?.t === 'op' && (toks[i] as { v: string }).v === '^' && toks[i + 1] && toks[i + 1].t !== '(') {
          // sin^2 x
          i++;
          power = readAtom();
        } else if (toks[i]?.t === 'op' && (toks[i] as { v: string }).v === '^' && toks[i + 1]?.t === '(') {
          // sin^(2)(x) is rare; treat ^(..) as power applied to function
          i++;
          power = readAtom();
        }
        let arg: string;
        if (toks[i]?.t === '(') arg = readAtom();
        else if (toks[i]?.t === '|') {
          // ln|x|
          let d = 0;
          const start = i;
          i++;
          for (; i < toks.length; i++) {
            if (toks[i].t === '(') d++;
            if (toks[i].t === ')') d--;
            if (toks[i].t === '|' && d === 0) break;
          }
          arg = `(abs(${emit(toks.slice(start + 1, i), ctx)}))`;
          i++;
        } else arg = `(${readBareArg()})`;
        const fnStr = name === 'exp' ? `e^${arg}` : `${name}${arg}`;
        push(power ? `(${fnStr})^${power}` : `(${fnStr})`, { t: 'id', v: '_' });
        prev = { t: ')' };
        break;
      }
    }
  }
  while (absStack.length) {
    out += ')';
    absStack.pop();
  }
  return out;
}

function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if ((ch === ',' || ch === ';') && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts
    .flatMap((p) => p.split(/\band\b|\bwith\b|\bwhere\b/))
    .map((p) => p.trim())
    .filter(Boolean);
}

function canonical(expr: string): string {
  try {
    return str(parse(expr)).replace(/\s+/g, '');
  } catch (e) {
    throw new InputError('I could not read that expression. Check the brackets and operators.');
  }
}

export function parseInput(raw: string): ParsedInput {
  const text = normalizeUnicode(raw).trim();
  if (!text) throw new InputError('Type a differential equation, for example y\' + 2y = e^x');
  const segments = splitTop(text);

  // Separate initial conditions: y(0)=1, y'(0)=2
  const icRe = /^([A-Za-z])\s*('*)\s*\(\s*([^()=]+)\s*\)\s*=\s*(.+)$/;
  const eqSegs: string[] = [];
  const icSegs: RegExpExecArray[] = [];
  for (const seg of segments) {
    const m = icRe.exec(seg);
    if (m && !/[A-Za-z]{2,}/.test(m[1]) && !/[xt]/.test(m[3].replace(/pi/g, ''))) icSegs.push(m);
    else eqSegs.push(seg);
  }
  if (eqSegs.length === 0) throw new InputError('I found initial conditions but no equation.');
  if (eqSegs.length > 1) throw new InputError('Enter one equation at a time (separate initial conditions with commas).');

  const eq = eqSegs[0];
  const sides = eq.split('=');
  if (sides.length > 2) throw new InputError('An equation should contain a single "=" sign.');
  const lhsToks = tokenize(sides[0]);
  const rhsToks = sides.length === 2 ? tokenize(sides[1]) : [];
  if (sides.length === 2 && !rhsToks.length) throw new InputError('The right-hand side is empty.');

  const all = [...lhsToks, ...rhsToks];
  const ders = all.filter((t): t is Extract<Tok, { t: 'der' }> => t.t === 'der');
  const diffs = all.filter((t): t is Extract<Tok, { t: 'diff' }> => t.t === 'diff');
  const ids = new Set(all.filter((t) => t.t === 'id').map((t) => (t as { v: string }).v));

  let dep: string;
  let indep: string;
  let differentialForm = false;
  if (ders.length) {
    dep = ders[0].v;
    if (ders.some((d) => d.v !== dep)) throw new InputError('Only one unknown function is supported.');
    const wrt = ders.find((d) => d.wrt)?.wrt;
    if (wrt) indep = wrt;
    else if (dep !== 'x' && ids.has('x')) indep = 'x';
    else if (dep !== 't' && ids.has('t')) indep = 't';
    else indep = dep === 'x' ? 't' : 'x';
    if (diffs.length) throw new InputError('Mixing derivatives (y\') with differentials (dx, dy) is not supported. Use one form.');
  } else if (diffs.length) {
    differentialForm = true;
    const letters = [...new Set(diffs.map((d) => d.v))];
    const pref = ['x', 't', 's', 'u', 'r'];
    if (letters.length === 2) {
      indep = pref.find((p) => letters.includes(p)) ?? letters[0];
      dep = letters.find((l) => l !== indep)!;
    } else {
      // only one differential, e.g. "dy = x dx" handled above; single one is ambiguous
      throw new InputError('In differential form, write both dx and dy, e.g. (2xy) dx + x^2 dy = 0');
    }
  } else {
    throw new InputError("I couldn't find a derivative. Use y', y'', dy/dx, or the form M dx + N dy = 0.");
  }

  const ctx: Ctx = { dep, indep };
  // Strip y(x) -> y in the equation
  const strip = (toks: Tok[]) => {
    const out: Tok[] = [];
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      out.push(t);
      if (
        ((t.t === 'id' && t.v === dep) || t.t === 'der') &&
        toks[k + 1]?.t === '(' &&
        toks[k + 2]?.t === 'id' &&
        (toks[k + 2] as { v: string }).v === indep &&
        toks[k + 3]?.t === ')'
      ) {
        k += 3;
      }
    }
    return out;
  };

  const lhs = canonical(emit(strip(lhsToks), ctx));
  const rhs = rhsToks.length ? canonical(emit(strip(rhsToks), ctx)) : '0';
  const F = canonical(`(${lhs})-(${rhs})`);
  const order = /\bypp\b/.test(F) ? 2 : 1;

  const ics: InitialCondition[] = icSegs.map((m) => {
    if (m[1] !== dep) throw new InputError(`Initial condition uses "${m[1]}" but the unknown is "${dep}"`);
    const ord = m[2].length;
    if (ord > 1) throw new InputError('Only conditions on y and y\' are supported.');
    const at = canonical(emit(tokenize(m[3]), ctx));
    const value = canonical(emit(tokenize(m[4]), ctx));
    return { order: ord, at, value };
  });

  const rename: Record<string, string> = {};
  if (indep !== 'x') rename.x = indep;
  if (dep !== 'y') rename.y = dep;
  return { F, order, differentialForm, dep, indep, ics, rename };
}
