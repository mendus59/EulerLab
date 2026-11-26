import type { SolveResult, SolveError } from './types';

type Pending = { resolve: (v: unknown) => void; timer: ReturnType<typeof setTimeout> };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; result: unknown }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(e.data.id);
    p.resolve(e.data.result);
  };
  return worker;
}

function reset() {
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.resolve(null);
  }
  pending.clear();
}

function call<T>(kind: 'solve' | 'preview', input: string, timeoutMs: number): Promise<T | null> {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reset();
      resolve(null);
    }, timeoutMs);
    pending.set(id, { resolve: resolve as (v: unknown) => void, timer });
    w.postMessage({ id, kind, input });
  });
}

export async function solveInWorker(input: string): Promise<SolveResult | SolveError> {
  const r = await call<SolveResult | SolveError>('solve', input, 15000);
  return r ?? { ok: false, error: 'This one took too long to solve symbolically. Try a simpler form, or check for typos.' };
}

export async function previewInWorker(input: string): Promise<string | null> {
  return call<string>('preview', input, 4000);
}
