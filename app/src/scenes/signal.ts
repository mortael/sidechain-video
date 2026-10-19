// `signal` — outro (instrumental fade). Pull back to a quiet, steady trace — no more drops
// falling, no gear, no joke ending. The video closes the way the song does: a slow fade to
// silence, ending on the trace alone.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { W, H, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, gradientLin } from '../engine/palette';
import { lerp, prog, fbm1 } from '../engine/util';
import type { AudioData } from '../engine/audio';

const CY = H / 2;
const COLOR_PHASE = 1.0;

export default class SignalScene extends Scene {
  trace = new LineBatch(260, { blend: 'add' });

  sampleY(au: AudioData, tx: number): number {
    const rms = au.env('rms', tx);
    return fbm1(tx * 0.6, 3, 13) * 50 * (0.3 + rms);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio: au } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.black);

    const fadeOut = prog(t, this.ctx.end - 6, this.ctx.end); // the final fade to silence
    const amp = lerp(1, 0.15, fadeOut);

    const Tr = this.trace; Tr.clear();
    const lit = gradientLin(COLOR_PHASE);
    const WINDOW_S = 3.6, N = 260;
    let prevX = 0, prevY = CY;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = u * W;
      const tx = t - (1 - u) * WINDOW_S;
      const y = CY + this.sampleY(au, tx) * amp;
      const b = lerp(1.1, 0.4, fadeOut);
      if (i > 0) Tr.seg2(prevX, prevY, x, y, lerp(3, 1.6, fadeOut), [lit[0] * b, lit[1] * b, lit[2] * b], lerp(1, 0.5, fadeOut));
      prevX = x; prevY = y;
    }
    Tr.render(renderer, out);

    return {
      exposure: 1.05,
      bloom: lerp(0.4, 0.1, fadeOut),
      bloomThreshold: 0.6,
      halation: 0,
      vignette: lerp(0.2, 0.45, fadeOut),
      grain: 0.03,
      fade: fadeOut * fadeOut, // eases into black slightly after the glow has already died down
    };
  }
}
