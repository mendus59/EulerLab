import { useMemo, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderMarkdown } from '../content/markdown';

export default function Markdown({ source, subject }: { source: string; subject: string }) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  const navigate = useNavigate();
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest('[data-solve]') as HTMLElement | null;
    if (btn) {
      e.preventDefault();
      navigate(`/${subject}/solver?eq=${encodeURIComponent(btn.dataset.solve ?? '')}`);
    }
  };
  return <div className="prose" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
