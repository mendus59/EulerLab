/**
 * Convert the LaTeX produced by the MathLive editor into the plain-text
 * notation understood by parseInput (e.g. "\frac{dy}{dx}=x^{2}y" -> "dy/dx=(x^(2))y").
 */

const CMD_TEXT: Record<string, string> = {
  cdot: '*', times: '*', div: '/', pi: 'pi', ln: 'ln ', log: 'ln ', exp: 'exp ',
  sin: 'sin ', cos: 'cos ', tan: 'tan ', sec: 'sec ', csc: 'csc ', cot: 'cot ',
  arcsin: 'arcsin ', arccos: 'arccos ', arctan: 'arctan ', sinh: 'sinh ', cosh: 'cosh ', tanh: 'tanh ',
  exponentialE: 'e', mathrm: '', operatorname: '', prime: "'", doubleprime: "''",
  differentialD: 'd', left: '', right: '', lbrace: '(', rbrace: ')', vert: '|', lvert: '|', rvert: '|', mid: '|',
  alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', epsilon: 'epsilon', theta: 'theta', lambda: 'lambda',
  mu: 'mu', nu: 'nu', rho: 'rho', sigma: 'sigma', tau: 'tau', phi: 'phi', omega: 'omega', kappa: 'kappa', xi: 'xi',
  quad: ' ', qquad: ' ', placeholder: '', mathit: '', text: '', textrm: '', displaystyle: '',
};

class Reader {
  i = 0;
  constructor(public s: string) {}
  peek() {
    return this.s[this.i];
  }
  eof() {
    return this.i >= this.s.length;
  }
}

function readCommand(r: Reader): string {
  // at '\'
  r.i++;
  const m = /^[a-zA-Z]+/.exec(r.s.slice(r.i));
  if (m) {
    r.i += m[0].length;
    return m[0];
  }
  const ch = r.s[r.i++] ?? '';
  return ch; // \, \; \! \{ etc
}

function skipSpaces(r: Reader) {
  while (!r.eof() && /\s/.test(r.peek())) r.i++;
}

/** Read one argument: {group} or a single token. Returns converted text. */
function readArg(r: Reader): string {
  skipSpaces(r);
  if (r.peek() === '{') {
    r.i++;
    const start = r.i;
    let depth = 1;
    while (!r.eof() && depth > 0) {
      const c = r.s[r.i];
      if (c === '\\') {
        r.i += 2;
        continue;
      }
      if (c === '{') depth++;
      if (c === '}') depth--;
      r.i++;
    }
    return convert(r.s.slice(start, r.i - 1));
  }
  if (r.peek() === '\\') {
    const c = readCommand(r);
    return CMD_TEXT[c] ?? c;
  }
  return r.s[r.i++] ?? '';
}

function readRawArg(r: Reader): string {
  skipSpaces(r);
  if (r.peek() === '{') {
    r.i++;
    const start = r.i;
    let depth = 1;
    while (!r.eof() && depth > 0) {
      if (r.s[r.i] === '{') depth++;
      if (r.s[r.i] === '}') depth--;
      r.i++;
    }
    return r.s.slice(start, r.i - 1);
  }
  return r.s[r.i++] ?? '';
}

function isDerivFrac(num: string, den: string): string | null {
  const clean = (t: string) => t.replace(/\\mathrm\{d\}|\\differentialD|\\mathrm d/g, 'd').replace(/[{}\s]/g, '');
  const n = clean(num);
  const d = clean(den);
  let m = /^d([A-Za-z])$/.exec(n);
  let k = /^d([A-Za-z])$/.exec(d);
  if (m && k) return `d${m[1]}/d${k[1]}`;
  m = /^d\^(\d)([A-Za-z])$/.exec(n);
  k = /^d([A-Za-z])\^(\d)$/.exec(d);
  if (m && k) return `d^${m[1]}${m[2]}/d${k[1]}^${k[2]}`;
  return null;
}

export function convert(latex: string): string {
  const r = new Reader(latex);
  let out = '';
  while (!r.eof()) {
    const c = r.peek();
    if (c === '\\') {
      const cmd = readCommand(r);
      if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
        const rawNum = readRawArg(r);
        const rawDen = readRawArg(r);
        const der = isDerivFrac(rawNum, rawDen);
        if (der) out += ` ${der} `;
        else out += `((${convert(rawNum)})/(${convert(rawDen)}))`;
        continue;
      }
      if (cmd === 'sqrt') {
        skipSpaces(r);
        if (r.peek() === '[') {
          const end = r.s.indexOf(']', r.i);
          const n = convert(r.s.slice(r.i + 1, end));
          r.i = end + 1;
          out += `((${readArg(r)})^(1/(${n})))`;
        } else out += `sqrt(${readArg(r)})`;
        continue;
      }
      if (cmd === 'mathrm' || cmd === 'operatorname' || cmd === 'text' || cmd === 'mathit' || cmd === 'textrm') {
        const inner = readArg(r);
        out += inner === 'd' ? 'd' : ` ${inner} `;
        continue;
      }
      if (cmd === 'left' || cmd === 'right') {
        skipSpaces(r);
        if (r.peek() === '\\') {
          const d = readCommand(r);
          out += d === '{' ? '(' : d === '}' ? ')' : CMD_TEXT[d] ?? '';
        } else if (r.peek() === '.') r.i++;
        else out += r.s[r.i++] === '[' ? '(' : r.s[r.i - 1] === ']' ? ')' : r.s[r.i - 1];
        continue;
      }
      if (cmd === ',' || cmd === ';' || cmd === '!' || cmd === ' ' || cmd === ':') {
        out += ' ';
        continue;
      }
      if (cmd === '{') {
        out += '(';
        continue;
      }
      if (cmd === '}') {
        out += ')';
        continue;
      }
      out += CMD_TEXT[cmd] ?? ` ${cmd} `;
      continue;
    }
    if (c === '^') {
      r.i++;
      skipSpaces(r);
      // primes: ^{\prime}, ^{\prime\prime}, ^\prime
      const save = r.i;
      const raw = readRawArg(r);
      const primes = raw.replace(/\s/g, '').match(/^(\\prime|\\doubleprime|')+$/);
      if (primes) {
        const n = (raw.match(/\\prime|'/g)?.length ?? 0) + 2 * (raw.match(/\\doubleprime/g)?.length ?? 0);
        out += "'".repeat(n);
        continue;
      }
      r.i = save;
      out += `^(${readArg(r)})`;
      continue;
    }
    if (c === '_') {
      r.i++;
      readArg(r); // ignore subscripts like C_1
      continue;
    }
    if (c === '{') {
      out += `(${readArg(r)})`;
      continue;
    }
    if (c === '~') {
      r.i++;
      out += ' ';
      continue;
    }
    out += c;
    r.i++;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Inverse-ish: plain text to a LaTeX string for loading examples into MathLive. */
export function textToLatex(text: string): string {
  return text
    .replace(/d\^2y\/dx\^2/g, '\\frac{d^2y}{dx^2}')
    .replace(/d([a-zA-Z])\/d([a-zA-Z])/g, '\\frac{d$1}{d$2}')
    .replace(/\bsqrt\(([^()]*)\)/g, '\\sqrt{$1}')
    .replace(/\be\^\(([^()]*)\)/g, 'e^{$1}')
    .replace(/\^\(([^()]*)\)/g, '^{$1}')
    .replace(/\b(sin|cos|tan|sec|csc|cot|ln|arctan|arcsin)\b/g, '\\$1')
    .replace(/\bpi\b/g, '\\pi')
    .replace(/\*/g, '\\cdot ');
}
