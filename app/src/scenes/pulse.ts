// `pulse` — the breakdown (instrumental, ~12 bars, no lyrics). The overflowing signal from
// `overflow` resolves into a slow, continuous ECG-style heartbeat line — "audio signal" recast as
// literally a pulse. The hypnotic, wordless centerpiece; the gradient slides toward violet across
// the section, and faint instrument-panel diagrams drift behind it at different depths.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { W, H, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, gradientLin } from '../engine/palette';
import { lerp, fract } from '../engine/util';

const CY = H / 2;

/** A classic ECG beat shape over phase 0..1: small P bump, QRS spike, rounded T wave, rest. */
function ecg(ph: number): number {
  if (ph < 0.12) return 0.06 * Math.sin((ph / 0.12) * Math.PI); // P wave
  if (ph < 0.22) return 0;
  if (ph < 0.25) return -0.15 * (ph - 0.22) / 0.03; // Q
  if (ph < 0.28) return -0.15 + 1.15 * (ph - 0.25) / 0.03; // R spike up
  if (ph < 0.31) return 1.0 - 1.3 * (ph - 0.28) / 0.03; // down through S
  if (ph < 0.34) return -0.3 + 0.3 * (ph - 0.31) / 0.03; // back to baseline
  if (ph < 0.42) return 0;
  if (ph < 0.58) return 0.22 * Math.sin(((ph - 0.42) / 0.16) * Math.PI); // T wave
  return 0;
}

export default class PulseScene extends Scene {
  bg = new LineBatch(4000, { blend: 'add', depthTest: false });
  trace = new LineBatch(700, { blend: 'add' });

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.black);
    const colorPhase = lerp(0.75, 0.9, f.p);
    const lit = gradientLin(colorPhase);

    // ---- faint panel diagrams drifting at different depths (parallax)
    const B = this.bg; B.clear();
    for (let layer = 0; layer < 3; layer++) {
      const depth = 1 + layer; // further layers drift slower, dimmer
      const speed = 14 / depth;
      const rows = 4, cols = 10;
      const y0 = 260 + layer * 180, spacing = 46;
      const alpha = 0.16 / depth;
      const drift = (t * speed) % spacing;
      for (let r = 0; r < rows; r++) {
        const y = y0 + r * spacing;
        for (let col = -1; col <= cols; col++) {
          const x = col * (W / cols) - drift;
          B.seg2(x, y, x + W / cols - 10, y, 1.2, LIN.mist, alpha);
        }
      }
    }
    B.render(renderer, out);

    // ---- the pulse: slow, continuous, scrolling
    const BPS = 0.95; // beats per second of the visual pulse (slower than the song's own tempo: hypnotic, not literal)
    const WINDOW_S = 5.2;
    const N = 500;
    const Tr = this.trace; Tr.clear();
    let prevX = 0, prevY = CY;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = u * W;
      const tx = t - (1 - u) * WINDOW_S;
      const ph = fract(tx * BPS);
      const y = CY - ecg(ph) * 150;
      const hot = Math.abs(ecg(ph)) > 0.7 ? 1 : 0;
      const boost = 1.1 + 2 * hot;
      if (i > 0) Tr.seg2(prevX, prevY, x, y, 2.6, [lit[0] * boost, lit[1] * boost, lit[2] * boost], 1);
      prevX = x; prevY = y;
    }
    Tr.render(renderer, out);

    return {
      exposure: 1.05,
      bloom: 0.5,
      bloomThreshold: 0.6,
      halation: 0,
      vignette: 0.3,
      grain: 0.04,
    };
  }
}
