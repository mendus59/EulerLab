import { useMemo } from 'react';
import { renderTex, renderInline } from '../content/markdown';

export function Tex({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => renderTex(tex, display), [tex, display]);
  return display ? (
    <div className={`math-display ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** Prose with inline $...$ math. */
export function Prose({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderInline(text), [text]);
  return <p className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
