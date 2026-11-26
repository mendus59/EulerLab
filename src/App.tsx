import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Link, NavLink, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import SubjectPage from './pages/SubjectPage';
import LessonPage from './pages/LessonPage';
import NotFound from './pages/NotFound';
import ThemeToggle from './components/ThemeToggle';

const SolverPage = lazy(() => import('./pages/SolverPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="EulerLab home">
            <span className="brand-mark" aria-hidden>
              e
            </span>
            <span className="brand-name">
              Euler<span>Lab</span>
            </span>
          </Link>
          <nav className="main-nav">
            <NavLink to="/differential-equations" end>
              Differential Equations
            </NavLink>
            <NavLink to="/differential-equations/solver">Solver</NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main>
        <Suspense fallback={<div className="container loading">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/:subject" element={<SubjectPage />} />
            <Route path="/:subject/solver" element={<SolverPage />} />
            <Route path="/:subject/lesson/:slug" element={<LessonPage kind="lesson" />} />
            <Route path="/:subject/guide/:slug" element={<LessonPage kind="guide" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="site-footer">
        <div className="container">
          EulerLab is a free learning companion. Solutions are computed in your browser and checked by substituting
          back into the equation, but always think it through yourself too.
        </div>
      </footer>
    </div>
  );
}
