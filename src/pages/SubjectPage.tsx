import { Link, useParams } from 'react-router-dom';
import { getSubject } from '../content/loader';
import Markdown from '../components/Markdown';
import NotFound from './NotFound';

export default function SubjectPage() {
  const { subject } = useParams();
  const s = getSubject(subject);
  if (!s) return <NotFound />;
  return (
    <div className="container subject-page">
      <div className="subject-head">
        <div>
          <p className="eyebrow">Subject</p>
          <h1>{s.title}</h1>
          <p className="lead">{s.summary}</p>
        </div>
        {s.tools.includes('solver') && (
          <Link to={`/${s.id}/solver`} className="solver-cta">
            <span className="solver-cta-title">Step-by-step solver →</span>
            <span>Enter any first-order or second-order linear equation and get annotated work.</span>
          </Link>
        )}
      </div>
      {s.body.trim() && <Markdown source={s.body} subject={s.id} />}

      <div className="subject-columns">
        <section>
          <h2 className="section-title">Lessons</h2>
          {s.chapters.length === 0 && (
            <div className="empty-note">
              Lessons will appear here chapter by chapter as they are written. In the meantime, the method guides cover the
              core techniques.
            </div>
          )}
          {s.chapters.map((c) => (
            <div key={c.number} className="chapter">
              <h3>
                <span className="chapter-num">Chapter {c.number}</span> {c.title}
              </h3>
              <ol className="lesson-list">
                {c.lessons.map((l) => (
                  <li key={l.slug}>
                    <Link to={`/${s.id}/lesson/${encodeURIComponent(l.slug)}`}>
                      <span className="section-num">{l.section}</span>
                      <span>
                        <span className="lesson-title">{l.title}</span>
                        {l.summary && <span className="lesson-summary">{l.summary}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
        <aside>
          <h2 className="section-title">Method guides</h2>
          <ul className="guide-list">
            {s.guides.map((g) => (
              <li key={g.slug}>
                <Link to={`/${s.id}/guide/${g.slug}`}>
                  <span className="lesson-title">{g.title}</span>
                  {g.summary && <span className="lesson-summary">{g.summary}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
