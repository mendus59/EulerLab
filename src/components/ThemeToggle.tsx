import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function read(): Theme {
  try {
    const t = localStorage.getItem('eulerlab-theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* ignore */
  }
  return 'system';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      if (theme === 'system') localStorage.removeItem('eulerlab-theme');
      else localStorage.setItem('eulerlab-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const next: Record<Theme, Theme> = { system: 'dark', dark: 'light', light: 'system' };
  const label = { system: 'Auto', dark: 'Dark', light: 'Light' }[theme];
  return (
    <button className="theme-toggle" type="button" onClick={() => setTheme(next[theme])} title="Switch color theme">
      <span aria-hidden>{theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}</span> {label}
    </button>
  );
}
