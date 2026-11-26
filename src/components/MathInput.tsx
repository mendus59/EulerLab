import { useEffect, useRef, useState } from 'react';
import { MathfieldElement, convertAsciiMathToLatex } from 'mathlive';
import 'mathlive/fonts.css';
import { convert, textToLatex } from '../solver/latex';

MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement> & {
        'math-virtual-keyboard-policy'?: string;
        placeholder?: string;
      };
    }
  }
}

interface PaletteItem {
  label: string; // TeX shown on the button
  insert: string; // LaTeX inserted into the editor
  text: string; // plain text inserted in text mode
  title: string;
}

const PALETTE: PaletteItem[][] = [
  [
    { label: "y'", insert: "y^{\\prime}", text: "y'", title: 'First derivative' },
    { label: "y''", insert: "y^{\\prime\\prime}", text: "y''", title: 'Second derivative' },
    { label: '\\frac{dy}{dx}', insert: '\\frac{dy}{dx}', text: 'dy/dx', title: 'dy/dx (Leibniz notation)' },
    { label: '\\frac{d^2y}{dx^2}', insert: '\\frac{d^2y}{dx^2}', text: 'd^2y/dx^2', title: 'Second derivative (Leibniz)' },
    { label: 'dx', insert: '\\,dx', text: ' dx', title: 'Differential dx (for M dx + N dy = 0)' },
    { label: 'dy', insert: '\\,dy', text: ' dy', title: 'Differential dy' },
  ],
  [
    { label: '\\frac{\\square}{\\square}', insert: '\\frac{#@}{#?}', text: '/', title: 'Fraction' },
    { label: 'x^{\\square}', insert: '#@^{#?}', text: '^', title: 'Power' },
    { label: 'e^{\\square}', insert: 'e^{#?}', text: 'e^(', title: 'Exponential' },
    { label: '\\sqrt{\\square}', insert: '\\sqrt{#0}', text: 'sqrt(', title: 'Square root' },
    { label: '\\ln', insert: '\\ln\\left(#0\\right)', text: 'ln(', title: 'Natural log' },
    { label: '\\sin', insert: '\\sin\\left(#0\\right)', text: 'sin(', title: 'Sine' },
    { label: '\\cos', insert: '\\cos\\left(#0\\right)', text: 'cos(', title: 'Cosine' },
    { label: '\\tan', insert: '\\tan\\left(#0\\right)', text: 'tan(', title: 'Tangent' },
    { label: '\\pi', insert: '\\pi', text: 'pi', title: 'Pi' },
  ],
  [
    { label: 'y(0)=\\square', insert: ',\\ y\\left(0\\right)=#?', text: ', y(0)=', title: 'Initial condition y(0)' },
    { label: "y'(0)=\\square", insert: ",\\ y^{\\prime}\\left(0\\right)=#?", text: ", y'(0)=", title: "Initial condition y'(0)" },
  ],
];

export interface MathInputProps {
  /** Plain-text value (the canonical form passed to the solver). */
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
}

export default function MathInput({ value, onChange, onSubmit }: MathInputProps) {
  const [mode, setMode] = useState<'visual' | 'text'>(() => {
    try {
      return localStorage.getItem('eulerlab-input-mode') === 'text' ? 'text' : 'visual';
    } catch {
      return 'visual';
    }
  });
  const mfRef = useRef<MathfieldElement | null>(null);
  const textRef = useRef<HTMLInputElement | null>(null);
  const lastEmitted = useRef<string>('');

  useEffect(() => {
    try {
      localStorage.setItem('eulerlab-input-mode', mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  // Wire up the math field
  useEffect(() => {
    const mf = mfRef.current;
    if (!mf || mode !== 'visual') return;
    mf.smartFence = true;
    mf.smartMode = false;
    mf.inlineShortcuts = { ...mf.inlineShortcuts, dydx: '\\frac{dy}{dx}', pi: '\\pi', ln: '\\ln' };
    const onInput = () => {
      const t = convert(mf.getValue('latex'));
      lastEmitted.current = t;
      onChange(t);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      }
    };
    mf.addEventListener('input', onInput);
    mf.addEventListener('keydown', onKey);
    return () => {
      mf.removeEventListener('input', onInput);
      mf.removeEventListener('keydown', onKey);
    };
  }, [mode, onChange, onSubmit]);

  // Push external value changes (examples, URL) into the math field
  useEffect(() => {
    const mf = mfRef.current;
    if (!mf || mode !== 'visual') return;
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    let latex: string;
    try {
      latex = asciiToLatex(value);
    } catch {
      latex = textToLatex(value);
    }
    mf.setValue(latex, { silenceNotifications: true });
  }, [value, mode]);

  const insert = (item: PaletteItem) => {
    if (mode === 'visual' && mfRef.current) {
      mfRef.current.executeCommand(['insert', item.insert, { selectionMode: 'placeholder', focus: true }]);
      const t = convert(mfRef.current.getValue('latex'));
      lastEmitted.current = t;
      onChange(t);
      mfRef.current.focus();
    } else if (textRef.current) {
      const el = textRef.current;
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + item.text + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + item.text.length;
        el.setSelectionRange(pos, pos);
      });
    }
  };

  return (
    <div className="math-input">
      <div className="math-input-top">
        <div className="seg" role="tablist" aria-label="Input mode">
          <button type="button" role="tab" aria-selected={mode === 'visual'} className={mode === 'visual' ? 'on' : ''} onClick={() => setMode('visual')}>
            Math editor
          </button>
          <button type="button" role="tab" aria-selected={mode === 'text'} className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>
            Plain text
          </button>
        </div>
        <span className="hint">
          {mode === 'visual' ? 'Type naturally: / makes a fraction, ^ a power, \' a prime.' : "Example: y' + 2y = e^x, y(0) = 1"}
        </span>
      </div>
      <div className="math-input-field">
        {mode === 'visual' ? (
          <math-field ref={mfRef} math-virtual-keyboard-policy="auto" placeholder="\text{e.g. } y'+2y=e^x" />
        ) : (
          <input
            ref={textRef}
            className="text-eq"
            value={value}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="y' + 2y = e^x, y(0) = 1"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit();
            }}
            aria-label="Differential equation"
          />
        )}
      </div>
      <div className="palette" aria-label="Symbol palette">
        {PALETTE.map((row, i) => (
          <div className="palette-row" key={i}>
            {row.map((item) => (
              <PaletteButton key={item.title} item={item} onClick={() => insert(item)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

import { renderTex } from '../content/markdown';
function PaletteButton({ item, onClick }: { item: PaletteItem; onClick: () => void }) {
  return (
    <button
      type="button"
      className="palette-btn"
      title={item.title}
      aria-label={item.title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: renderTex(item.label, false) }}
    />
  );
}

/** Plain text -> LaTeX for the editor. Handles derivative notations that ASCIIMath doesn't. */
function asciiToLatex(text: string): string {
  const protectedText = text
    .replace(/d\^2\s*([a-zA-Z])\s*\/\s*d\s*([a-zA-Z])\s*\^2/g, '§D2$1$2§')
    .replace(/\bd([a-zA-Z])\s*\/\s*d([a-zA-Z])\b/g, '§D1$1$2§')
    .replace(/([a-zA-Z])''/g, '§P2$1§')
    .replace(/([a-zA-Z])'/g, '§P1$1§');
  let latex = convertAsciiMathToLatex(protectedText);
  latex = latex
    .replace(/§D2(\w)(\w)§/g, '\\frac{d^2$1}{d$2^2}')
    .replace(/§D1(\w)(\w)§/g, '\\frac{d$1}{d$2}')
    .replace(/§P2(\w)§/g, "$1^{\\prime\\prime}")
    .replace(/§P1(\w)§/g, "$1^{\\prime}");
  if (/§/.test(latex)) throw new Error('conversion failed');
  return latex;
}
