import { Link, useParams } from 'react-router-dom';
import { getSubject, allLessons } from '../content/loader';
import Markdown from '../components/Markdown';
import NotFound from './NotFound';

export default function LessonPage({ kind }: { kind: 'lesson' | 'guide' }) {
  const { subject, slug } = useParams();
  const s = getSubject(subject);
  if (!s) return <NotFound />;
  const lessons = allLessons(s);
  const list = kind === 'lesson' ? lessons : s.guides;
  const idx = list.findIndex((l) => l.slug === slug);
  if (idx < 0) return <NotFound />;
  const page = list[idx];
  const prev = list[idx - 1];
  const next = list[idx + 1];
  const href = (p: { slug: string }) => `/${s.id}/${kind}/${encodeURIComponent(p.slug)}`;
  const lesson = kind === 'lesson' ? lessons[idx] : null;

  return (
    <div className="container lesson-layout">
      <aside className="lesson-nav">
        <Link to={`/${s.id}`} className="lesson-nav-subject">
          ← {s.title}
        </Link>
        {s.chapters.map((c) => (
          <div key={c.number} className="lesson-nav-group">
            <div className="lesson-nav-heading">
              {c.number}. {c.title}
            </div>
            {c.lessons.map((l) => (
              <Link key={l.slug} to={`/${s.id}/lesson/${encodeURIComponent(l.slug)}`} className={kind === 'lesson' && l.slug === slug ? 'active' : ''}>
                <span className="section-num">{l.section}</span> {l.title}
              </Link>
            ))}
          </div>
        ))}
        <div className="lesson-nav-group">
          <div className="lesson-nav-heading">Method guides</div>
          {s.guides.map((g) => (
            <Link key={g.slug} to={`/${s.id}/guide/${g.slug}`} className={kind === 'guide' && g.slug === slug ? 'active' : ''}>
              {g.title}
            </Link>
          ))}
        </div>
        {s.tools.includes('solver') && (
          <Link to={`/${s.id}/solver`} className="lesson-nav-solver">
            Open the solver →
          </Link>
        )}
      </aside>
      <article className="lesson">
        <p className="eyebrow">
          {lesson ? `Chapter ${lesson.chapter} · ${lesson.chapterTitle}` : 'Method guide'}
        </p>
        <h1>
          {lesson && <span className="section-num big">{lesson.section}</span>} {page.title}
        </h1>
        {page.summary && <p className="lead">{page.summary}</p>}
        <Markdown source={page.body} subject={s.id} />
        <nav className="pager">
          {prev ? (
            <Link to={href(prev)} className="pager-link">
              <span>← Previous</span>
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link to={href(next)} className="pager-link next">
              <span>Next →</span>
              {next.title}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
    </div>
  );
}
