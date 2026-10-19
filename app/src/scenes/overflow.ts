// `overflow` — the bridge, "If I stop ducking, I overflow / If I feel it raw, I lose control".
// Cormorant italic enters for the first time (the unguarded register). A bypass switch flips,
// the trace blows out past 0dBFS into visible clipping, the gradient at full intensity, breaking
// out of its own oscilloscope housing into the surrounding dark.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba, gradientLin, gradientRgba } from '../engine/palette';
import { F, font, glyphX } from '../engine/type';
import { Lyrics, type Line } from '../engine/lyrics';
import { clamp, lerp, prog, ease, noise1 } from '../engine/util';

const HX0 = 460, HX1 = W - 460, HY0 = 360, HY1 = 760, HCY = (HY0 + HY1) / 2;
const COLOR_PHASE = 0.65;

export default class OverflowScene extends Scene {
  layer = new Layer2D();
  trace = new LineBatch(260, { blend: 'add' });
  lines: Line[] = [];

  override async init() {
    const ly = this.ctx.lyrics;
    this.lines = [ly.get('If I stop ducking'), ly.get('If I feel it raw')];
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const bypass = prog(t, this.ctx.start + 0.1, this.ctx.start + 0.6, ease.outCubic);
    const blow = ease.inCubic(clamp(f.p * 1.15)); // the overflow builds across the whole bridge

    clearRT(renderer, out, LIN.black);

    const L = this.layer; L.clear();
    const c = L.ctx;
    // oscilloscope housing
    c.strokeStyle = rgba('mist', 0.6);
    c.strokeRect(HX0, HY0, HX1 - HX0, HY1 - HY0);
    c.font = font(F.mono(500), 16);
    c.fillStyle = rgba('mist', 0.7);
    c.textAlign = 'left';
    c.fillText(bypass > 0.5 ? 'COMPRESSOR · BYPASSED' : 'COMPRESSOR · ENGAGED', HX0, HY0 - 18);

    // the lyric, Cormorant italic — the unguarded register, for the first time
    const line = this.lines.find((l) => t >= l.start - 0.5 && t < l.end + 0.6) ?? null;
    if (line) {
      const fam = F.serif(400, true), size = 72;
      c.font = font(fam, size);
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      const vis = prog(t, line.start - 0.5, line.start);
      let ci = 0;
      const total = c.measureText(line.text).width;
      const x0 = W / 2 - total / 2;
      for (const w of line.words) {
        const p = Lyrics.wordProgress(w, t);
        c.fillStyle = p > 0 ? gradientRgba(COLOR_PHASE, 0.95) : rgba('mist', 0.4 * vis);
        c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size), 900);
        ci += Array.from(w.w).length + 1;
      }
    }
    comp.draw(renderer, L.upload(), out);

    // the waveform: clean at first, clipping harder and spilling past the housing as it builds
    const Tr = this.trace; Tr.clear();
    const lit = gradientLin(COLOR_PHASE);
    const gain = lerp(1, 7, blow);
    let prevX = 0, prevY = HCY;
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = lerp(HX0, HX1, u);
      const raw = Math.sin((t - (1 - u) * 0.6) * 38) * 0.6 + noise1((t - (1 - u) * 0.6) * 9, 4) * 0.4;
      const clipped = clamp(raw * gain, -1, 1);
      const amp = (HY1 - HY0) / 2 * lerp(0.9, 1.9, blow); // the signal overflows past the housing's own edge
      const y = HCY - clipped * amp;
      const hot = Math.abs(clipped) > 0.85 ? 1 : 0;
      const boost = 1 + 2.5 * blow + 2 * hot;
      Tr.seg2(prevX, prevY, x, y, 2.6 + 2 * blow, [lit[0] * boost, lit[1] * boost, lit[2] * boost], 1);
      prevX = x; prevY = y;
    }
    Tr.render(renderer, out);

    return {
      exposure: 1.1,
      bloom: 0.3 + 0.6 * blow,
      bloomThreshold: lerp(0.8, 0.4, blow),
      halation: 0,
      vignette: 0.22,
      grain: 0.04,
      shake: [0, 3 * blow * Math.sin(t * 61)],
    };
  }
}
