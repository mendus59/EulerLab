import { Link } from 'react-router-dom';
import { SUBJECTS, allLessons } from '../content/loader';
import { Tex } from '../components/Tex';

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <p className="eyebrow">A learning companion for mathematics</p>
            <h1>
              Learn math by <em>working through it</em>.
            </h1>
            <p className="lead">
              EulerLab pairs clear, self-contained lessons with tools that show every step. Start with differential
              equations: type an equation and see how to solve it, why each step works, and what the solutions look like.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/differential-equations/solver">
                Try the solver
              </Link>
              <Link className="btn" to="/differential-equations">
                Browse lessons
              </Link>
            </div>
          </div>
          <div className="hero-card" aria-hidden>
            <div className="hero-card-label">Example</div>
            <Tex display tex="\frac{dy}{dx} = xy, \quad y(0) = 1" />
            <div className="hero-step">
              <span>1</span> Separate: <Tex tex="\tfrac{1}{y}\,dy = x\,dx" />
            </div>
            <div className="hero-step">
              <span>2</span> Integrate: <Tex tex="\ln|y| = \tfrac{x^2}{2} + C" />
            </div>
            <div className="hero-step">
              <span>3</span> Solve: <Tex tex="y = e^{x^2/2}" />
            </div>
          </div>
        </div>
      </section>
      <section className="container">
        <h2 className="section-title">Subjects</h2>
        <div className="subject-grid">
          {SUBJECTS.map((s) => {
            const count = allLessons(s).length + s.guides.length;
            const inner = (
              <>
                <div className="subject-icon" aria-hidden>
                  {s.icon}
                </div>
                <h3>{s.title}</h3>
                <p>{s.summary}</p>
                <div className="subject-meta">
                  {s.status === 'soon' ? <span className="badge badge-muted">Coming later</span> : <span className="badge">{count} pages</span>}
                  {s.tools.includes('solver') && <span className="badge badge-accent">Step-by-step solver</span>}
                </div>
              </>
            );
            return s.status === 'soon' ? (
              <div key={s.id} className="subject-card is-soon">
                {inner}
              </div>
            ) : (
              <Link key={s.id} to={`/${s.id}`} className="subject-card">
                {inner}
              </Link>
            );
          })}
        </div>
      </section>
      <section className="container features">
        <div className="feature">
          <h3>Every step, annotated</h3>
          <p>The solver identifies the type of equation, picks a method, and explains each move, not just the answer.</p>
        </div>
        <div className="feature">
          <h3>Type math naturally</h3>
          <p>
            Use the visual editor and symbol palette, or plain text like <code>y' + 2y = e^x, y(0)=1</code>.
          </p>
        </div>
        <div className="feature">
          <h3>See the solutions</h3>
          <p>Slope fields and solution curves show what a differential equation is really saying. Click to trace your own.</p>
        </div>
      </section>
    </div>
  );
}
