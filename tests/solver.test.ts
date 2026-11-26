import { describe, it, expect } from 'vitest';
import { solveODE } from '../src/solver/index';
import { parseInput } from '../src/solver/parseInput';
import { convert } from '../src/solver/latex';
import { renderMarkdown } from '../src/content/markdown';
import { parseFrontMatter } from '../src/content/frontmatter';

const cases: { eq: string; method: string; particular?: boolean }[] = [
  { eq: "y' = xy", method: 'separable' },
  { eq: "y' = 2x, y(0)=1", method: 'direct', particular: true },
  { eq: "y' + 2y = e^x, y(0) = 1", method: 'linear', particular: true },
  { eq: "x y' + y = x^2", method: 'linear' },
  { eq: "y' + y tan x = sec x", method: 'linear' },
  { eq: '(2xy + 3)dx + (x^2 - 1)dy = 0', method: 'exact' },
  { eq: '(y cos x + 2x e^y) dx + (sin x + x^2 e^y - 1) dy = 0', method: 'exact' },
  { eq: '(3xy + y^2) dx + (x^2 + xy) dy = 0', method: 'intfactor' },
  { eq: "y' + y = x y^3", method: 'bernoulli' },
  { eq: 'dy/dx = (x^2+y^2)/(xy)', method: 'homogeneous' },
  { eq: "y' = y(1-y), y(0) = 1/2", method: 'separable', particular: true },
  { eq: 'dP/dt = kP', method: 'separable' },
  { eq: "y'' - 3y' + 2y = 0, y(0)=1, y'(0)=0", method: 'constcoef', particular: true },
  { eq: "y'' + 2y' + y = 0", method: 'constcoef' },
  { eq: "y'' - 4y' + 13y = 0", method: 'constcoef' },
  { eq: "y'' + 4y = sin(2x)", method: 'constcoef' },
  { eq: "y'' + y' - 2y = x^2", method: 'constcoef' },
  { eq: "y'' + y = sec x", method: 'constcoef' },
  { eq: "x'' + 4x = 0, x(0)=1, x'(0)=0", method: 'constcoef', particular: true },
  { eq: "x^2 y'' + x y' - 4y = 0", method: 'euler' },
];

describe('solver', () => {
  for (const c of cases) {
    it(c.eq, () => {
      const r = solveODE(c.eq);
      expect(r.ok, r.ok ? '' : r.error).toBe(true);
      if (!r.ok) return;
      const m = r.methods.find((x) => x.id === c.method);
      expect(m, `methods: ${r.methods.map((x) => x.id).join(',')}`).toBeTruthy();
      expect(m!.verified).toBe(true);
      expect(m!.steps.length).toBeGreaterThan(1);
      if (c.particular) expect(m!.particularTex).toBeTruthy();
    }, 30000);
  }

  it('reports unsupported equations kindly', () => {
    const r = solveODE("y''' = y");
    expect(r.ok).toBe(false);
  });
});

describe('input parsing', () => {
  it('handles notations', () => {
    expect(parseInput("dy/dx = xy").F).toBe('yp-x*y');
    expect(parseInput("y'=2xsinx").F).toBe('yp-2*x*sin(x)');
    expect(parseInput("dP/dt = kP").rename).toEqual({ x: 't', y: 'P' });
    expect(parseInput("y'' + y = 0, y(0)=1, y'(0)=2").ics).toHaveLength(2);
  });
  it('converts MathLive LaTeX', () => {
    expect(convert('\\frac{dy}{dx}=xy')).toContain('dy/dx');
    expect(convert("y^{\\prime\\prime}+y=0")).toBe("y''+y=0");
  });
});

describe('content', () => {
  it('parses front matter from the notes tool', () => {
    const { data, body } = parseFrontMatter('---\nchapter: 1\nchapter_title: Introduction\nsection: "1.10"\ntitle: Hello\n---\nBody');
    expect(data).toEqual({ chapter: 1, chapter_title: 'Introduction', section: '1.10', title: 'Hello' });
    expect(body).toBe('Body');
  });
  it('renders math, callouts and solve blocks', () => {
    const html = renderMarkdown(':::definition Order\nThe $n$th derivative, $$y^{(n)}$$\n:::\n\n```solve\ny\' = y\n```');
    expect(html).toContain('callout-definition');
    expect(html).toContain('katex');
    expect(html).toContain('data-solve');
  });
});
