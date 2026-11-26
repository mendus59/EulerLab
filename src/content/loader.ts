/**
 * Loads all Markdown content under /content at build time.
 *
 *   content/<subject>/_subject.md            subject metadata
 *   content/<subject>/lessons/**.md          lessons (front matter: chapter, chapter_title, section, title)
 *   content/<subject>/guides/*.md            method guides (front matter: title, order, method)
 *
 * See README.md ("Content format") for details.
 */
import { parseFrontMatter } from './frontmatter';
import type { FrontValue } from './frontmatter';

const files = import.meta.glob('/content/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export interface Subject {
  id: string;
  title: string;
  summary: string;
  order: number;
  status: 'active' | 'soon';
  tools: string[];
  icon: string;
  body: string;
  chapters: Chapter[];
  guides: Guide[];
}

export interface Chapter {
  number: number;
  title: string;
  lessons: Lesson[];
}

export interface Lesson {
  subject: string;
  chapter: number;
  chapterTitle: string;
  section: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  path: string;
}

export interface Guide {
  subject: string;
  slug: string;
  title: string;
  summary: string;
  order: number;
  method: string[];
  body: string;
}

function s(v: FrontValue | undefined, d = ''): string {
  if (v === undefined) return d;
  return Array.isArray(v) ? v.join(', ') : String(v);
}

function sectionKey(section: string): number[] {
  return section.split(/[.\-]/).map((p) => (/^\d+$/.test(p) ? Number(p) : 0));
}

function cmpSection(a: string, b: string): number {
  const ka = sectionKey(a);
  const kb = sectionKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const d = (ka[i] ?? -1) - (kb[i] ?? -1);
    if (d) return d;
  }
  return a.localeCompare(b);
}

function build(): Subject[] {
  const subjects = new Map<string, Subject>();
  const lessons: Lesson[] = [];
  const guides: Guide[] = [];
  for (const [path, raw] of Object.entries(files)) {
    const parts = path.replace(/^\/content\//, '').split('/');
    const subject = parts[0];
    const file = parts[parts.length - 1];
    const { data, body } = parseFrontMatter(raw);
    if (file === '_subject.md') {
      subjects.set(subject, {
        id: subject,
        title: s(data.title, subject),
        summary: s(data.summary),
        order: Number(data.order ?? 99),
        status: data.status === 'soon' ? 'soon' : 'active',
        tools: Array.isArray(data.tools) ? data.tools : data.tools ? [String(data.tools)] : [],
        icon: s(data.icon, '∑'),
        body,
        chapters: [],
        guides: [],
      });
      continue;
    }
    if (file.startsWith('_')) continue;
    const base = file.replace(/\.md$/, '');
    if (parts[1] === 'guides') {
      guides.push({
        subject,
        slug: base.replace(/^\d+[-_]/, ''),
        title: s(data.title, base),
        summary: s(data.summary),
        order: Number(data.order ?? 99),
        method: Array.isArray(data.method) ? data.method : data.method ? [String(data.method)] : [],
        body,
      });
      continue;
    }
    const chapter = Number(data.chapter ?? (parseInt(parts[2] ?? '', 10) || 0));
    const section = s(data.section, base.replace(/^(\d+(?:\.\d+)*).*/, '$1'));
    lessons.push({
      subject,
      chapter,
      chapterTitle: s(data.chapter_title, `Chapter ${chapter}`),
      section,
      slug: section && /^\d/.test(section) ? section : base,
      title: s(data.title, base),
      summary: s(data.summary),
      body,
      path,
    });
  }
  for (const l of lessons) {
    const sub = subjects.get(l.subject);
    if (!sub) continue;
    let ch = sub.chapters.find((c) => c.number === l.chapter);
    if (!ch) {
      ch = { number: l.chapter, title: l.chapterTitle, lessons: [] };
      sub.chapters.push(ch);
    }
    if (ch.title.startsWith('Chapter ') && !l.chapterTitle.startsWith('Chapter ')) ch.title = l.chapterTitle;
    ch.lessons.push(l);
  }
  for (const g of guides) subjects.get(g.subject)?.guides.push(g);
  for (const sub of subjects.values()) {
    sub.chapters.sort((a, b) => a.number - b.number);
    for (const c of sub.chapters) c.lessons.sort((a, b) => cmpSection(a.section, b.section));
    sub.guides.sort((a, b) => a.order - b.order);
  }
  return [...subjects.values()].sort((a, b) => a.order - b.order);
}

export const SUBJECTS = build();

export function getSubject(id: string | undefined): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

export function allLessons(sub: Subject): Lesson[] {
  return sub.chapters.flatMap((c) => c.lessons);
}

export function guideForMethod(subjectId: string, method: string): Guide | undefined {
  return getSubject(subjectId)?.guides.find((g) => g.method.includes(method));
}
