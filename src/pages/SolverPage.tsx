import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import MathInput from '../components/MathInput';
import StepList from '../components/StepList';
import SlopeField from '../components/SlopeField';
import { Tex, Prose } from '../components/Tex';
import { solveInWorker } from '../solver/client';
import { previewTex } from '../solver/index';
import type { SolveResult, SolveError } from '../solver/types';
import { guideForMethod } from '../content/loader';

const EXAMPLES: { group: string; items: { eq: string; label?: string }[] }[] = [
  {
    group: 'First order',
    items: [
      { eq: "y' = xy, y(0) = 1", label: 'Separable' },
      { eq: "y' + 2y = e^x", label: 'Linear' },
      { eq: '(2xy + 3) dx + (x^2 - 1) dy = 0', label: 'Exact' },
      { eq: "y' + y = x y^3", label: 'Bernoulli' },
      { eq: 'dy/dx = (x^2 + y^2)/(x y)', label: 'Homogeneous' },
      { eq: "y' = y(1 - y), y(0) = 1/2", label: 'Logistic' },
    ],
  },
  {
    group: 'Second order',
    items: [
      { eq: "y'' - 3y' + 2y = 0, y(0) = 1, y'(0) = 0", label: 'Real roots' },
      { eq: "y'' + 2y' + 5y = 0", label: 'Complex roots' },
      { eq: "y'' + 4y = sin(2x)", label: 'Resonance' },
      { eq: "y'' + y = sec x", label: 'Variation of parameters' },
      { eq: "x^2 y'' + x y' - 4y = 0", label: 'Cauchy–Euler' },
    ],
  },
];

export default function SolverPage() {
  const { subject = 'differential-equations' } = useParams();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(() => params.get('eq') ?? '');
  const [result, setResult] = useState<SolveResult | SolveError | null>(null);
  const [busy, setBusy] = useState(false);
  const [methodIdx, setMethodIdx] = useState(0);

  const preview = useMemo(() => (input.trim() ? previewTex(input) : null), [input]);

  const solve = useCallback(
    async (eq?: string) => {
      const text = (eq ?? input).trim();
      if (!text) return;
      setBusy(true);
      setParams({ eq: text }, { replace: true });
      const r = await solveInWorker(text);
      setResult(r);
      setMethodIdx(0);
      setBusy(false);
    },
    [input, setParams],
  );

  // Solve on load / when navigated with ?eq=
  const urlEq = params.get('eq');
  useEffect(() => {
    if (urlEq && (!result || urlEq !== input)) {
      setInput(urlEq);
      void solve(urlEq);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlEq]);

  const onSubmit = useCallback(() => void solve(), [solve]);

  return (
    <div className="container solver-page">
      <div className="solver-head">
        <p className="eyebrow">
          <Link to={`/${subject}`}>Differential Equations</Link> · Solver
        </p>
        <h1>Step-by-step solver</h1>
        <p className="lead">
          Enter an ordinary differential equation, optionally with initial conditions. EulerLab identifies its type, solves
          it with a textbook method, explains each step, and checks the answer.
        </p>
      </div>

      <div className="card solver-input">
        <MathInput value={input} onChange={setInput} onSubmit={onSubmit} />
        <div className="solver-actions">
          <div className="preview" aria-live="polite">
            {input.trim() ? (
              preview ? (
                <>
                  <span className="preview-label">Interpreted as</span> <Tex tex={preview} />
                </>
              ) : (
                <span className="preview-label">Keep typing… (not a complete equation yet)</span>
              )
            ) : (
              <span className="preview-label">Pick an example below or type your own.</span>
            )}
          </div>
          <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={busy || !input.trim()}>
            {busy ? 'Solving…' : 'Solve'}
          </button>
        </div>
        <div className="examples">
          {EXAMPLES.map((g) => (
            <div key={g.group} className="example-group">
              <span className="example-group-label">{g.group}</span>
              {g.items.map((ex) => (
                <button
                  key={ex.eq}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setInput(ex.eq);
                    void solve(ex.eq);
                  }}
                  title={ex.eq}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {busy && !result && <div className="card loading">Working it out…</div>}
      {result && !result.ok && (
        <div className="card error-card" role="alert">
          <strong>Can't solve this one yet.</strong> {result.error}
        </div>
      )}
      {result && result.ok && <Result result={result} methodIdx={methodIdx} setMethodIdx={setMethodIdx} subject={subject} busy={busy} />}

      <details className="card help">
        <summary>How to type equations</summary>
        <div className="help-grid">
          <div>
            <h4>Derivatives</h4>
            <p>
              <code>y'</code>, <code>y''</code>, <code>dy/dx</code>, <code>d^2y/dx^2</code>. Other letters work too: <code>dP/dt = kP</code>,{' '}
              <code>x'' + 4x = 0</code>.
            </p>
          </div>
          <div>
            <h4>Differential form</h4>
            <p>
              <code>(2xy + 3) dx + (x^2 - 1) dy = 0</code>
            </p>
          </div>
          <div>
            <h4>Initial conditions</h4>
            <p>
              After a comma: <code>y(0) = 1, y'(0) = 2</code>
            </p>
          </div>
          <div>
            <h4>Functions</h4>
            <p>
              <code>e^x</code>, <code>exp(x)</code>, <code>ln x</code>, <code>sin x</code>, <code>sqrt(x)</code>, <code>|x|</code>. Multiplication
              can be implicit: <code>2xy</code> means 2·x·y.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}

function Result({
  result,
  methodIdx,
  setMethodIdx,
  subject,
  busy,
}: {
  result: SolveResult;
  methodIdx: number;
  setMethodIdx: (i: number) => void;
  subject: string;
  busy: boolean;
}) {
  const m = result.methods[Math.min(methodIdx, result.methods.length - 1)];
  const guide = guideForMethod(subject, m.id);
  return (
    <div className={busy ? 'result is-busy' : 'result'}>
      <div className="card result-summary">
        <div className="classify">
          <span className="badge">Order {result.classification.order}</span>
          <span className="badge">{result.classification.linear ? 'Linear' : 'Nonlinear'}</span>
          {result.classification.tags.map((t) => (
            <span key={t} className="badge badge-accent">
              {t}
            </span>
          ))}
        </div>
        <Tex tex={result.equationTex + (result.icsTex.length ? ', \\quad ' + result.icsTex.join(', \\ ') : '')} display className="result-eq" />
        <div className="answer">
          <div className="answer-label">{m.particularTex ? 'Solution of the initial value problem' : 'General solution'}</div>
          <Tex tex={m.particularTex ?? m.generalTex ?? ''} display />
          {m.particularTex && m.generalTex && (
            <div className="answer-general">
              General solution: <Tex tex={m.generalTex} />
            </div>
          )}
          {m.singular && m.singular.length > 0 && (
            <div className="answer-general">
              Also: {m.singular.map((s, i) => <Tex key={i} tex={`${result.plot.rename.y ?? 'y'} = ${texNum(s.expr)}`} />)} (see the last step)
            </div>
          )}
          <div className={m.verified ? 'check ok' : 'check'}>
            {m.verified ? '✓ Checked: substituting this back into the equation works.' : 'This answer could not be automatically checked. Verify it by substituting back.'}
          </div>
        </div>
      </div>

      {result.methods.length > 1 && (
        <div className="method-tabs" role="tablist" aria-label="Solution methods">
          <span className="method-tabs-label">{result.methods.length} methods apply:</span>
          {result.methods.map((mm, i) => (
            <button key={mm.id} type="button" role="tab" aria-selected={i === methodIdx} className={i === methodIdx ? 'tab on' : 'tab'} onClick={() => setMethodIdx(i)}>
              {mm.name}
            </button>
          ))}
        </div>
      )}

      <div className="result-grid">
        <div className="card steps-card">
          <div className="steps-head">
            <h2>{m.name}</h2>
            {guide && (
              <Link to={`/${subject}/guide/${guide.slug}`} className="learn-link">
                Learn this method →
              </Link>
            )}
          </div>
          <Prose text={m.why} className="why" />
          <StepList steps={m.steps} />
        </div>
        <div className="card plot-card">
          <h2>{result.plot.order === 1 ? 'Slope field' : 'Solution curves'}</h2>
          <SlopeField plot={result.plot} />
          <p className="plot-note">
            {result.plot.order === 1
              ? `Each short segment has slope ${'y\''} at that point. Solutions are curves that follow the segments.`
              : 'Curves are computed numerically, so you can compare them with the formula.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function texNum(expr: string): string {
  return expr.replace(/\*/g, ' ');
}
