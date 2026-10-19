// `unmasked` — outro tag, "No pump, no shield / Just everything I kept concealed". The console
// imagery falls away: no mask, no meter, no gear. Cormorant italic returns, sustained this time.
// The trace runs steady at full dynamic range, in magenta — moving with the real voice, not
// pumping to a kick anymore.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, gradientLin, gradientRgba, rgba } from '../engine/palette';
import { F, font, glyphX } from '../engine/type';
import { Lyrics, type Line } from '../engine/lyrics';
import { lerp, prog, fbm1 } from '../engine/util';
import type { AudioData } from '../engine/audio';

const CY = H / 2;
const COLOR_PHASE = 0.95;

export default class UnmaskedScene extends Scene {
  trace = new LineBatch(260, { blend: 'add' });
  layer = new Layer2D();
  lines: Line[] = [];

  override async init() {
    const ly = this.ctx.lyrics;
    this.lines = [ly.get('No pump, no shield'), ly.get('Just everything I kept concealed')];
  }

  sampleY(au: AudioData, tx: number): number {
    const vocal = au.env('vocal', tx), rms = au.env('rms', tx);
    return fbm1(tx * 0.7, 3, 11) * 60 * (0.3 + vocal * 1.2 + rms * 0.3);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.black);
    const settle = prog(t, this.ctx.start, this.ctx.start + 2.5); // the imagery falls away, calm settles in

    // ---- the trace: steady, full dynamic range, no duck
    const Tr = this.trace; Tr.clear();
    const lit = gradientLin(COLOR_PHASE);
    const WINDOW_S = 3.2, N = 240;
    let prevX = 0, prevY = CY;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = u * W;
      const tx = t - (1 - u) * WINDOW_S;
      const y = CY + this.sampleY(au, tx) + CY * 0.22 * (1 - settle); // drifts up into place as it settles
      const boost = lerp(0.7, 1.3, settle);
      if (i > 0) Tr.seg2(prevX, prevY, x, y, 3, [lit[0] * boost, lit[1] * boost, lit[2] * boost], settle);
      prevX = x; prevY = y;
    }
    Tr.render(renderer, out);

    // ---- the lyric: Cormorant italic, sustained (the most recent line whose start has passed)
    const line = [...this.lines].reverse().find((l) => t >= l.start - 0.6) ?? null;
    if (line) {
      const L2 = this.layer;
      L2.clear();
      const c = L2.ctx;
      const fam = F.serif(400, true), size = 84;
      c.font = font(fam, size);
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      const vis = prog(t, line.start - 0.6, line.start + 0.3);
      const total = c.measureText(line.text).width;
      const x0 = W / 2 - total / 2;
      let ci = 0;
      for (const w of line.words) {
        const p = Lyrics.wordProgress(w, t);
        c.fillStyle = p > 0 ? gradientRgba(COLOR_PHASE, 0.95 * vis) : rgba('mist', 0.5 * vis);
        c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size), CY - 220);
        ci += Array.from(w.w).length + 1;
      }
      comp.draw(renderer, L2.upload(), out);
    }

    return {
      exposure: 1.1,
      bloom: 0.35 + 0.2 * settle,
      bloomThreshold: 0.55,
      halation: 0,
      vignette: 0.2,
      grain: 0.03,
    };
  }
}
