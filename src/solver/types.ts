export interface Step {
  title: string;
  /** Prose; may contain inline TeX between $...$ */
  text?: string;
  /** Display equations (TeX). */
  math?: string[];
  substeps?: Step[];
}

export type GeneralSolution =
  | { kind: 'explicit'; exprs: string[] }
  | { kind: 'implicit'; lhs: string; rhs: string };

export interface MethodResult {
  id: string;
  name: string;
  /** One-line description of why the method applies. */
  why: string;
  steps: Step[];
  general: GeneralSolution | null;
  /** Extra solutions not in the general family (e.g. equilibria). */
  singular?: { expr: string; note: string }[];
  /** Number of arbitrary constants (1 for first order, 2 for second). */
  constants: string[];
}

export interface Classification {
  order: number;
  linear: boolean;
  tags: string[];
}

export interface SolveResult {
  ok: true;
  /** TeX of the interpreted equation */
  equationTex: string;
  icsTex: string[];
  classification: Classification;
  methods: FinishedMethod[];
  /** Data for plotting */
  plot: PlotData;
}

export interface FinishedMethod extends MethodResult {
  /** TeX of the general solution, e.g. "y = Ce^{x}" */
  generalTex: string | null;
  /** TeX of the particular solution after applying initial conditions */
  particularTex: string | null;
  verified: boolean;
  /** Final solution(s) as expression strings when explicit (for plotting) */
  explicitFinal?: string[];
}

export interface PlotData {
  order: number;
  /** y' = f(x, y) for first order, y'' = f(x, y, yp) for second order */
  f: string | null;
  ics: { at: number; value: number; order: number }[];
  /** Explicit particular solution(s) for overlay, if available */
  curves: string[];
  /** Explicit general solution with free constants, for families */
  family: string | null;
  constants: string[];
  rename: Record<string, string>;
}

export interface SolveError {
  ok: false;
  error: string;
}
