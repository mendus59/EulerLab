import { tex } from '../cas/tex';
import type { TexOpts } from '../cas/tex';

/** Display helpers bound to the learner's variable names. */
export class Disp {
  constructor(public rename: Record<string, string> = {}) {}
  get x() {
    return this.rename.x ?? 'x';
  }
  get y() {
    return this.rename.y ?? 'y';
  }
  with(extra: Record<string, string>): Disp {
    return new Disp({ ...this.rename, ...extra });
  }
  opts(): TexOpts {
    return { rename: this.rename };
  }
  t(expr: string): string {
    return tex(expr, this.opts());
  }
  eq(lhs: string, rhs: string): string {
    return `${this.t(lhs)} = ${this.t(rhs)}`;
  }
  /** dy/dx in Leibniz notation */
  get dydx(): string {
    return `\\frac{d${this.y}}{d${this.x}}`;
  }
  get yp(): string {
    return `${this.y}'`;
  }
  /** TeX wrapped in parentheses when it is a sum */
  p(expr: string): string {
    const t = this.t(expr);
    return /[+-]/.test(t.replace(/^-/, '').replace(/\{[^{}]*\}/g, '')) ? `\\left(${t}\\right)` : t;
  }
  /** inline math */
  i(expr: string): string {
    return `$${this.t(expr)}$`;
  }
}
