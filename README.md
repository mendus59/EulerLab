# EulerLab

A learning companion for mathematics, starting with **differential equations**.

**Live site:** https://mendus59.github.io/EulerLab/

- **Step-by-step solver.** Type an ODE (with a visual math editor and symbol palette, or plain text) and get annotated work: classification, the method, every step, the general solution, the solution of the initial value problem, and an automatic check that substitutes the answer back into the equation.
- **Slope fields.** Every first-order result has an interactive slope field; click to trace solutions.
- **Lessons and method guides** written in Markdown with KaTeX math.

Everything runs in the browser (no server). The symbolic engine uses [nerdamer](https://github.com/jiggzson/nerdamer) for integration/solving and [math.js](https://mathjs.org) for parsing and numeric checks.

## What the solver handles

| Order | Types |
|---|---|
| First | direct integration, separable, linear (integrating factor), exact, integrating factor μ(x) or μ(y), Bernoulli, homogeneous (y/x) |
| Second | linear with constant coefficients (all three root cases), undetermined coefficients (with the modification rule), variation of parameters, Cauchy–Euler |

Input examples: `y' + 2y = e^x, y(0)=1`, `dy/dx = xy`, `(2xy+3)dx + (x^2-1)dy = 0`, `dP/dt = kP`, `y'' + 4y = sin(2x)`, `x^2 y'' + x y' - 4y = 0`.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # solver + content tests
npm run build    # static site in dist/
```

Pushing to `main` runs the tests, builds, and deploys to GitHub Pages (`.github/workflows/deploy.yml`). In the repository settings, **Pages → Source** must be set to **GitHub Actions**.

## Content format

All content lives in `content/` and is picked up automatically at build time (no code changes needed).

```
content/
  <subject>/
    _subject.md              subject card (title, summary, order, status, icon, tools)
    lessons/                 one Markdown file per textbook section (subfolders allowed)
      ch01/1.1-what-is-a-de.md
    guides/                  stand-alone method guides
      02-separable.md
```

### Lessons

This is the same format the EulerLab study-notes tool exports, so a pasted chunk can be saved as-is.

```markdown
---
chapter: 1
chapter_title: Introduction to Differential Equations
section: "1.1"
title: Definitions and Terminology
summary: Optional one-line summary shown in the lesson list.
---

Body in GitHub-flavored Markdown. Inline math $y' = 2y$, display math:

$$\frac{dy}{dx} = f(x, y)$$

(`\( ... \)` and `\[ ... \]` work too.)

:::definition Order
The order of a differential equation is the order of its highest derivative.
:::

:::example Solving a separable equation
**Solution.** ...
:::

```solve
y' = 2xy, y(0) = 1
```
```

- Lessons are grouped by `chapter` (titled by `chapter_title`) and ordered by `section` (`1.2` before `1.10`). The URL is `#/differential-equations/lesson/<section>`.
- **Callouts:** `:::type Optional title` ... `:::` (one level, no nesting). Types: `definition`, `theorem`, `example`, `note`, `tip`, `warning`, `exercise`, `summary`, plus collapsible `solution` and `proof`.
- **Solver links:** a fenced ```` ```solve ```` block (one equation per line) renders a "Solve step by step" button that opens the solver with that equation.
- Raw HTML is escaped, not rendered.

### Guides

Same Markdown body. Front matter: `title`, `summary`, `order`, and `method: [...]` listing solver method ids (`direct`, `separable`, `linear`, `exact`, `intfactor`, `bernoulli`, `homogeneous`, `constcoef`, `euler`). The solver shows a "Learn this method" link to the matching guide.

### Adding another subject

Create `content/<id>/_subject.md` with `status: active` (or `soon` for a placeholder card) and add lessons under it.

## Project layout

```
src/cas/        math.js + nerdamer wrappers, LaTeX pretty-printer
src/solver/     input parser, LaTeX->text, first- and second-order methods, web worker
src/content/    content loader, front matter, Markdown + KaTeX renderer
src/components/ MathInput (MathLive), StepList, SlopeField, ...
src/pages/      Home, Subject, Lesson/Guide, Solver
tests/          vitest suite
```
