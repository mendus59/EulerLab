import { solveODE, previewTex } from './index';

self.onmessage = (e: MessageEvent<{ id: number; kind: 'solve' | 'preview'; input: string }>) => {
  const { id, kind, input } = e.data;
  if (kind === 'preview') {
    (self as unknown as Worker).postMessage({ id, result: previewTex(input) });
    return;
  }
  const result = solveODE(input);
  (self as unknown as Worker).postMessage({ id, result });
};
