import { useEffect, useMemo, useRef, useState } from 'react';
import { evalAt } from '../cas/math';
import type { PlotData } from '../solver/types';

interface View {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const COLORS = ['#4f46e5', '#db2777', '#059669', '#d97706', '#0891b2', '#7c3aed'];

function rk4First(f: string, x: number, y: number, h: number, steps: number, view: View): [number, number][] {
  const pts: [number, number][] = [[x, y]];
  const F = (a: number, b: number) => evalAt(f, { x: a, y: b });
  const span = view.y1 - view.y0;
  for (let i = 0; i < steps; i++) {
    const k1 = F(x, y);
    const k2 = F(x + h / 2, y + (h / 2) * k1);
    const k3 = F(x + h / 2, y + (h / 2) * k2);
    const k4 = F(x + h, y + h * k3);
    const ny = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    if (!Number.isFinite(ny) || Math.abs(ny - view.y0) > 6 * span || Math.abs(ny - view.y1) > 6 * span) break;
    x += h;
    y = ny;
    pts.push([x, y]);
    if (x < view.x0 - 0.01 || x > view.x1 + 0.01) break;
  }
  return pts;
}

function rk4Second(f: string, x: number, y: number, v: number, h: number, steps: number, view: View): [number, number][] {
  const pts: [number, number][] = [[x, y]];
  const A = (a: number, b: number, c: number) => evalAt(f, { x: a, y: b, yp: c });
  const span = view.y1 - view.y0;
  for (let i = 0; i < steps; i++) {
    const k1y = v, k1v = A(x, y, v);
    const k2y = v + (h / 2) * k1v, k2v = A(x + h / 2, y + (h / 2) * k1y, v + (h / 2) * k1v);
    const k3y = v + (h / 2) * k2v, k3v = A(x + h / 2, y + (h / 2) * k2y, v + (h / 2) * k2v);
    const k4y = v + h * k3v, k4v = A(x + h, y + h * k3y, v + h * k3v);
    const ny = y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    const nv = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    if (!Number.isFinite(ny) || Math.abs(ny) > 1e6 + 6 * span) break;
    x += h;
    y = ny;
    v = nv;
    pts.push([x, y]);
    if (x < view.x0 - 0.01 || x > view.x1 + 0.01) break;
  }
  return pts;
}

function defaultView(plot: PlotData): View {
  const ic = plot.ics.find((c) => c.order === 0 && Number.isFinite(c.at) && Number.isFinite(c.value));
  const cx = ic ? ic.at : 0;
  const cy = ic ? ic.value : 0;
  const r = 5;
  return { x0: cx - r, x1: cx + r, y0: cy - r * 0.7, y1: cy + r * 0.7 };
}

export default function SlopeField({ plot }: { plot: PlotData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(() => defaultView(plot));
  const [seeds, setSeeds] = useState<[number, number][]>([]);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const xName = plot.rename.x ?? 'x';
  const yName = plot.rename.y ?? 'y';

  useEffect(() => {
    setView(defaultView(plot));
    setSeeds([]);
  }, [plot]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(280, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = Math.round(Math.min(width * 0.62, 460));

  // Curves to draw
  const curves = useMemo(() => {
    const out: { pts: [number, number][]; color: string; width: number; label?: string }[] = [];
    if (!plot.f) return out;
    const steps = 800;
    const h = (view.x1 - view.x0) / 400;
    const trace = (x: number, y: number, v = 0) => {
      if (plot.order === 1) {
        const fwd = rk4First(plot.f!, x, y, h, steps, view);
        const back = rk4First(plot.f!, x, y, -h, steps, view);
        return [...back.reverse(), ...fwd.slice(1)];
      }
      const fwd = rk4Second(plot.f!, x, y, v, h, steps, view);
      const back = rk4Second(plot.f!, x, y, v, -h, steps, view);
      return [...back.reverse(), ...fwd.slice(1)];
    };
    const ic0 = plot.ics.find((c) => c.order === 0);
    const ic1 = plot.ics.find((c) => c.order === 1);
    if (ic0 && Number.isFinite(ic0.at) && Number.isFinite(ic0.value)) {
      out.push({ pts: trace(ic0.at, ic0.value, ic1?.value ?? 0), color: COLORS[0], width: 3, label: 'IVP' });
    } else if (plot.order === 2) {
      // a few sample solutions through (0, k) with y'(0)=0 and (0,0) with y'(0)=k
      [-2, 1, 2].forEach((k, i) => out.push({ pts: trace(0, k, 0), color: COLORS[(i + 1) % COLORS.length], width: 2 }));
      out.push({ pts: trace(0, 0, 1.5), color: COLORS[4], width: 2 });
    }
    seeds.forEach(([x, y], i) => out.push({ pts: trace(x, y, 0), color: COLORS[(i + 1) % COLORS.length], width: 2.2 }));
    return out;
  }, [plot, view, seeds]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(cv);
    const fg = css.getPropertyValue('--plot-fg').trim() || '#334';
    const grid = css.getPropertyValue('--plot-grid').trim() || '#e5e7eb';
    const axis = css.getPropertyValue('--plot-axis').trim() || '#9ca3af';
    ctx.clearRect(0, 0, width, height);
    const X = (x: number) => ((x - view.x0) / (view.x1 - view.x0)) * width;
    const Y = (y: number) => height - ((y - view.y0) / (view.y1 - view.y0)) * height;

    // grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = grid;
    ctx.beginPath();
    for (let gx = Math.ceil(view.x0); gx <= view.x1; gx++) {
      ctx.moveTo(X(gx), 0);
      ctx.lineTo(X(gx), height);
    }
    for (let gy = Math.ceil(view.y0); gy <= view.y1; gy++) {
      ctx.moveTo(0, Y(gy));
      ctx.lineTo(width, Y(gy));
    }
    ctx.stroke();
    // axes
    ctx.strokeStyle = axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (view.y0 < 0 && view.y1 > 0) {
      ctx.moveTo(0, Y(0));
      ctx.lineTo(width, Y(0));
    }
    if (view.x0 < 0 && view.x1 > 0) {
      ctx.moveTo(X(0), 0);
      ctx.lineTo(X(0), height);
    }
    ctx.stroke();
    ctx.fillStyle = axis;
    ctx.font = '11px Inter, system-ui, sans-serif';
    for (let gx = Math.ceil(view.x0); gx <= view.x1; gx++) if (gx !== 0 && gx % 2 === 0) ctx.fillText(String(gx), X(gx) + 2, Math.min(height - 4, Math.max(12, Y(0) + 13)));
    for (let gy = Math.ceil(view.y0); gy <= view.y1; gy++) if (gy !== 0 && gy % 2 === 0) ctx.fillText(String(gy), Math.min(width - 18, Math.max(3, X(0) + 4)), Y(gy) - 3);

    // slope field (first order only)
    if (plot.order === 1 && plot.f) {
      const nx = Math.round(width / 30);
      const ny = Math.round(height / 30);
      const sx = (view.x1 - view.x0) / nx;
      const sy = (view.y1 - view.y0) / ny;
      const len = Math.min(width / nx, height / ny) * 0.36;
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i <= nx; i++) {
        for (let j = 0; j <= ny; j++) {
          const x = view.x0 + i * sx;
          const y = view.y0 + j * sy;
          const m = evalAt(plot.f, { x, y });
          if (!Number.isFinite(m)) continue;
          // slope in pixel space
          const dxp = width / (view.x1 - view.x0);
          const dyp = height / (view.y1 - view.y0);
          const ang = Math.atan2(m * dyp, dxp);
          const cx = X(x), cy = Y(y);
          ctx.moveTo(cx - len * Math.cos(ang), cy + len * Math.sin(ang));
          ctx.lineTo(cx + len * Math.cos(ang), cy - len * Math.sin(ang));
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // curves
    for (const c of curves) {
      ctx.strokeStyle = c.color;
      ctx.lineWidth = c.width;
      ctx.beginPath();
      let pen = false;
      for (const [x, y] of c.pts) {
        const px = X(x), py = Y(y);
        if (!Number.isFinite(py) || Math.abs(py) > 1e5) {
          pen = false;
          continue;
        }
        if (!pen) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        pen = true;
      }
      ctx.stroke();
    }
    // IC point
    const ic0 = plot.ics.find((c) => c.order === 0);
    if (ic0 && Number.isFinite(ic0.at) && Number.isFinite(ic0.value)) {
      ctx.fillStyle = COLORS[0];
      ctx.beginPath();
      ctx.arc(X(ic0.at), Y(ic0.value), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [i, [x, y]] of seeds.entries()) {
      ctx.fillStyle = COLORS[(i + 1) % COLORS.length];
      ctx.beginPath();
      ctx.arc(X(x), Y(y), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [plot, view, curves, seeds, width, height]);

  const toWorld = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = view.x0 + ((e.clientX - r.left) / r.width) * (view.x1 - view.x0);
    const y = view.y1 - ((e.clientY - r.top) / r.height) * (view.y1 - view.y0);
    return [x, y];
  };

  const zoom = (k: number) => {
    const cx = (view.x0 + view.x1) / 2;
    const cy = (view.y0 + view.y1) / 2;
    const hw = ((view.x1 - view.x0) / 2) * k;
    const hh = ((view.y1 - view.y0) / 2) * k;
    setView({ x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh });
  };

  return (
    <div className="plot" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height }}
        onClick={(e) => setSeeds((s) => [...s.slice(-7), toWorld(e)])}
        onMouseMove={(e) => setHover(toWorld(e))}
        onMouseLeave={() => setHover(null)}
        aria-label={plot.order === 1 ? 'Slope field with solution curves. Click to draw a solution through a point.' : 'Solution curves'}
        role="img"
      />
      <div className="plot-bar">
        <span className="plot-hint">
          {plot.order === 1
            ? 'Click anywhere to trace the solution through that point.'
            : plot.ics.length
              ? 'The solution of your initial value problem.'
              : `Sample solutions. Click to start one at that point with ${yName}' = 0.`}
          {hover && (
            <span className="plot-coord">
              {' '}
              ({xName}, {yName}) = ({hover[0].toFixed(2)}, {hover[1].toFixed(2)})
            </span>
          )}
        </span>
        <span className="plot-buttons">
          <button type="button" className="btn btn-small" onClick={() => zoom(0.7)} aria-label="Zoom in">
            +
          </button>
          <button type="button" className="btn btn-small" onClick={() => zoom(1.4)} aria-label="Zoom out">
            −
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              setSeeds([]);
              setView(defaultView(plot));
            }}
          >
            Reset
          </button>
        </span>
      </div>
    </div>
  );
}
