// `console` — intro. A patch bay at rest: dim jacks, every meter flat, the trace dormant.
// Nothing is sung here; the scene is driven entirely by the real audio envelope (whatever
// energy is actually building in the intro bars shows up on its own — no hand-placed cues).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, gradientLin, rgba } from '../engine/palette';
import { font } from '../engine/type';
import type { AudioData } from '../engine/audio';
import { clamp, lerp, prog, ease, fbm1 } from '../engine/util';
import { duckAmount, spikeAmount, recentKicks, dropletAt } from './_signal';

const WINDOW_S = 2.4; // seconds of trace visible across the frame width
const TRACE_Y = H / 2;
const AMP_UP = 130; // px, spike height
const AMP_DOWN = 95; // px, duck depth
const N = 420; // trace samples

/** Patch-bay rows: each one meters a real stem, not a decoration. */
const ROWS: { label: string; y: number; env: (au: AudioData, t: number) => number }[] = [
  { label: 'SEND A · VOX', y: 360, env: (au, t) => au.env('vocal', t) },
  { label: 'SEND B · INST', y: 560, env: (au, t) => au.env('other', t) },
  { label: 'RETURN · LOW', y: 760, env: (au, t) => Math.max(au.env('bass', t), au.env('drums', t)) },
];
const GRID_COLS = 16, GRID_X0 = 220, GRID_X1 = W - 220;

export default class ConsoleScene extends Scene {
  trace = new LineBatch(N + 40, { blend: 'add' });
  meters = new LineBatch(ROWS.length * GRID_COLS + 8, { blend: 'add' });
  grid = new Layer2D();

  override async init() {
    this.drawGrid();
  }

  /** Dormant patch-bay jacks and labels: static, drawn once. The reactive glow is a separate
   * LineBatch layer redrawn every frame (see meterRow in render()). */
  drawGrid() {
    const c = this.grid.ctx;
    this.grid.clear();
    c.strokeStyle = rgba('mist', 0.55);
    c.font = font(this.labelFont, 14);
    c.textBaseline = 'middle';
    for (const row of ROWS) {
      c.fillStyle = rgba('paper', 0.6);
      c.fillText(row.label, GRID_X0 - 150, row.y);
      for (let col = 0; col < GRID_COLS; col++) {
        const x = lerp(GRID_X0, GRID_X1, col / (GRID_COLS - 1));
        c.beginPath();
        c.arc(x, row.y, 7, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }
  labelFont = 'Plex-400';

  /** Trace height (px offset from baseline) at absolute song time tx, and how "lit" it is there:
   * a continuous idle wobble from the real vocal/instrument envelopes (so the console visibly
   * reacts to the hummed intro, not just kicks), plus the sharper kick-driven spike/duck on top. */
  sampleY(au: AudioData, tx: number): { y: number; activity: number } {
    const vocal = au.env('vocal', tx), other = au.env('other', tx), rms = au.env('rms', tx);
    const life = clamp(vocal * 0.8 + other * 0.5);
    const idle = fbm1(tx * 0.55, 3, 7) * 24 * (0.2 + life);
    const spike = spikeAmount(au, tx, 0.045);
    const duck = duckAmount(au, tx, { depth: 1 });
    const y = idle - spike * AMP_UP + duck * AMP_DOWN;
    return { y, activity: clamp(spike + duck * 0.7 + life * 0.5 + rms * 0.12) };
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.black);

    // the patch bay fades in fast (this is frame 1 of the whole video)
    const gridA = prog(t, 0, 0.4);
    if (gridA > 0.001) comp.draw(renderer, this.grid.upload(), out, { opacity: gridA });

    // ---- the meter rows: each jack row lights up left-to-right like an LED ladder, one row per
    // real stem (vocal/instrument/low) — this is what actually shows the hummed intro building.
    const colorPhase = 0.06; // earliest plate: cyan end of the gradient
    const lit = gradientLin(colorPhase);
    const M = this.meters; M.clear();
    for (const row of ROWS) {
      const v = clamp(row.env(au, t));
      const n = Math.round(v * GRID_COLS);
      for (let col = 0; col < n; col++) {
        const x = lerp(GRID_X0, GRID_X1, col / (GRID_COLS - 1));
        M.seg(x, row.y, 0, x + 1e-3, row.y, 0, 5.5, lit[0] * 1.8, lit[1] * 1.8, lit[2] * 1.8, gridA * 0.9);
      }
    }
    M.render(renderer, out);

    // ---- the trace: a scrolling window ending "now" (t), gradient-tinted only where active.
    // The idle baseline is a bright grey (paper/mist mix), not flat mist: this is a hairline on
    // a CRT, not a shadow — it should read clearly even when nothing is happening.
    const L = this.trace; L.clear();
    const IDLE: [number, number, number] = [
      lerp(LIN.mist[0], LIN.paper[0], 0.5), lerp(LIN.mist[1], LIN.paper[1], 0.5), lerp(LIN.mist[2], LIN.paper[2], 0.5),
    ];
    let prevX = 0, prevY = TRACE_Y;
    for (let i = 0; i <= N; i++) {
      const u = i / N; // 0 = oldest (left), 1 = now (right)
      const x = u * W;
      const tx = t - (1 - u) * WINDOW_S;
      const { y: dy, activity } = this.sampleY(au, tx);
      const y = TRACE_Y + dy;
      const boost = 1 + 2.6 * activity; // the active part of the line blooms
      const rgb: [number, number, number] = [
        lerp(IDLE[0], lit[0] * boost, activity),
        lerp(IDLE[1], lit[1] * boost, activity),
        lerp(IDLE[2], lit[2] * boost, activity),
      ];
      if (i > 0) L.seg2(prevX, prevY, x, y, 3.2, rgb, 1);
      prevX = x; prevY = y;
    }
    // droplets: one per recent kick, positioned where its dip actually bottoms out (delay + dipTime
    // after the kick, matching duckAmount's defaults) — not at the kick's own onset time.
    const DELAY = 0.02, DIP_TIME = 0.12;
    for (const [dt] of recentKicks(au, t, WINDOW_S + 0.5)) {
      const drop = dropletAt(dt);
      if (drop.alpha <= 0.002) continue;
      const u = 1 - (dt - DELAY - DIP_TIME) / WINDOW_S;
      if (u < -0.05 || u > 1.05) continue;
      const x = u * W;
      const y = TRACE_Y + AMP_DOWN * 0.98 + drop.fallPx;
      const r = 3 + 4 * drop.grow;
      const rgb = gradientLin(colorPhase);
      L.seg(x, y, 0, x + 1e-3, y, 0, r * 2, rgb[0] * 1.6, rgb[1] * 1.6, rgb[2] * 1.6, drop.alpha * 0.9);
    }
    L.render(renderer, out);

    return {
      exposure: 1.1,
      bloom: 0.65,
      bloomThreshold: 0.55,
      halation: 0, // the gradient is cyan->magenta, not orange: skip the engine's orange film halation
      vignette: 0.2,
      grain: 0.035,
      fade: 1 - prog(t, 0, 0.6, ease.outCubic),
    };
  }
}
