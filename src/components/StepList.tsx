import { useState } from 'react';
import type { Step } from '../solver/types';
import { Tex, Prose } from './Tex';

export default function StepList({ steps, nested = false }: { steps: Step[]; nested?: boolean }) {
  return (
    <ol className={nested ? 'steps steps-nested' : 'steps'}>
      {steps.map((s, i) => (
        <StepItem key={i} step={s} n={i + 1} />
      ))}
    </ol>
  );
}

function StepItem({ step, n }: { step: Step; n: number }) {
  const [open, setOpen] = useState(true);
  return (
    <li className="step">
      <div className="step-num" aria-hidden>
        {n}
      </div>
      <div className="step-body">
        <h4 className="step-title">
          {step.substeps ? (
            <button type="button" className="step-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
              <span className={open ? 'caret open' : 'caret'}>▸</span> {step.title}
            </button>
          ) : (
            step.title
          )}
        </h4>
        {step.text && <Prose text={step.text} className="step-text" />}
        {step.math?.map((m, i) => (
          <Tex key={i} tex={m} display className="step-math" />
        ))}
        {step.substeps && open && <StepList steps={step.substeps} nested />}
      </div>
    </li>
  );
}
