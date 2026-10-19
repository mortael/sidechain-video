// `facade` — verse 1, "Smile compression". The mask beside a perfectly flatlined scope: the GR
// meter is pinned, crushing a signal we never see move. Black-and-paper only — no gradient colour
// anywhere in this scene, the first fully "suppressed" plate.
//
// Each line gets its own treatment, not a repeated template (see docs/ENGINE.md on P(doom)'s
// per-line choreography): L1 plain and steady; L2 visibly compresses on the word "compression";
// L3 flattens vertically per word, literally, on "flat"; L4 is capped dim and shrinks away by its
// own end ("nowhere to show"). The mask itself is a GLSL engraving (radial hatch + the project's
// own mask SDF for the ink eyes/smile), not a flat Canvas2D icon — it breathes with a slow drift.
// In the back half, after the last lyric line, the real bass/kick build already happening in the
// song (verse 1's dead-air tail) is allowed to crack the flatline open, foreshadowing `threshold1`.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font, glyphX } from '../engine/type';
import { Lyrics, type Line } from '../engine/lyrics';
import { clamp, lerp, prog, ease, pulse } from '../engine/util';
import { duckAmount, spikeAmount } from './_signal';
import { GLSL_MASK } from './_motifs';

const MASK_X = 420, MASK_Y = 440, MASK_R = 170;
const TRACE_Y = MASK_Y;
const TRACE_X0 = MASK_X + MASK_R + 110, TRACE_X1 = W - 160;
const N = 240;

const MASK_FRAG = /* glsl */ `
${GLSL_MASK}
uniform vec2 uRes;
uniform float uT;
uniform vec2 uMaskC;
uniform float uMaskR;
uniform float uTremor;
void main() {
  vec2 sp = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec3 col = C_BLACK;
  // a very faint drifting cross-hatch over the whole sheet: the paper is alive, not a dead flat colour
  vec2 drift = vec2(uT * 5.0, uT * 2.2);
  float bgHatch = engrave((sp + drift) * 0.012, 0.18, 1.0, 0.35);
  col += C_MIST * bgHatch * 0.045;
  // the mask: a disc of radial engraving, the eyes/smile cut into it as dark grooves
  vec2 mp = (sp - uMaskC) / uMaskR;
  float rd = length(mp) - 1.0;
  float edge = aaFill(rd);
  if (edge > 0.001) {
    float ink = sdMaskInk(mp);
    float inkLine = aaStroke(ink, 0.035);
    float ang = atan(mp.y, mp.x);
    float radial = hatch(length(mp) * 13.0 + uTremor * 0.4, 0.28 + 0.22 * sin(ang * 3.0 + uT * 0.25));
    vec3 face = C_PAPER * (0.32 + 0.55 * radial);
    face = mix(face, C_BLACK, inkLine);
    col = mix(col, face, edge);
    float rim = aaStroke(rd, 0.01);
    col = mix(col, C_PAPER, rim * 0.6 * edge);
  }
  fragColor = vec4(col, 1.0);
}`;

export default class FacadeScene extends Scene {
  bg = new FSPass(MASK_FRAG, {
    uRes: { value: new THREE.Vector2(W, H) }, uT: { value: 0 },
    uMaskC: { value: new THREE.Vector2(MASK_X, MASK_Y) }, uMaskR: { value: MASK_R }, uTremor: { value: 0 },
  });
  layer = new Layer2D();
  trace = new LineBatch(N + 8, { blend: 'add' });
  lines: Line[] = [];

  override async init() {
    const ly = this.ctx.lyrics;
    this.lines = [
      ly.get('I keep it cool'),
      ly.get('Smile compression'),
      ly.get('Words stay flat'),
      ly.get('Feelings muted'),
    ];
  }

  /** How "cracked open" the flatline is: 0 through the sung lines, ramping to 1 over the last
   * 10s before the cut into `threshold1` — right where the real bass/kick build re-enters. */
  crackAt(t: number) {
    return prog(t, this.ctx.end - 10, this.ctx.end);
  }

  /** L1: plain, steady — the baseline everything else departs from. */
  drawLine1(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, x0: number, y0: number) {
    const vis = prog(t, line.start - 0.45, line.start);
    let ci = 0;
    for (const w of line.words) {
      const p = Lyrics.wordProgress(w, t);
      c.fillStyle = p > 0 ? rgba('paper', 0.95) : rgba('mist', 0.45 * vis);
      c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size, 1.5), y0);
      ci += Array.from(w.w).length + 1;
    }
  }

  /** L2: visibly compresses — each word snaps from stretched to normal height right on its own start,
   * hardest on "compression" itself. */
  drawLine2(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, x0: number, y0: number) {
    const vis = prog(t, line.start - 0.45, line.start);
    let ci = 0;
    for (const w of line.words) {
      const p = Lyrics.wordProgress(w, t);
      const isCompression = w.w.toLowerCase().startsWith('compression');
      const squeeze = pulse(t, w.start, isCompression ? 0.22 : 0.1) * (isCompression ? 1 : 0.4);
      const sy = 1 + 1.1 * squeeze, sx = 1 - 0.25 * squeeze;
      const wx = x0 + glyphX(line.text, ci, fam, size, 1.5);
      c.save();
      c.translate(wx, y0);
      c.scale(sx, sy);
      c.fillStyle = p > 0 ? rgba('paper', 0.95) : rgba('mist', 0.45 * vis);
      c.fillText(w.w, 0, 0);
      c.restore();
      ci += Array.from(w.w).length + 1;
    }
  }

  /** L3: literally flattens — every word's own height collapses toward zero right as it's sung,
   * then holds flat. "no highs, no lows" reads as a flat line of type. */
  drawLine3(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, x0: number, y0: number) {
    const vis = prog(t, line.start - 0.45, line.start);
    let ci = 0;
    for (const w of line.words) {
      const p = Lyrics.wordProgress(w, t);
      const flatten = prog(t, w.start, w.start + 0.18, ease.outCubic);
      const sy = lerp(1, 0.18, flatten);
      const wx = x0 + glyphX(line.text, ci, fam, size, 1.5);
      c.save();
      c.translate(wx, y0 - size * 0.3 * (1 - sy));
      c.scale(1, sy);
      c.fillStyle = p > 0 ? rgba('paper', 0.95) : rgba('mist', 0.45 * vis);
      c.fillText(w.w, 0, 0);
      c.restore();
      ci += Array.from(w.w).length + 1;
    }
  }

  /** L4: capped dim (never reaches full paper brightness: "muted") and shrinks away by the line's
   * own end — "nowhere to show" leaves nothing behind. */
  drawLine4(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, x0: number, y0: number) {
    const vis = prog(t, line.start - 0.45, line.start);
    const vanish = prog(t, line.end - 0.3, line.end + 0.15, ease.inCubic);
    const scale = lerp(1, 0.4, vanish);
    c.save();
    c.translate(W / 2, 0);
    c.scale(scale, scale);
    c.translate(-W / 2, 0);
    c.globalAlpha = 1 - vanish;
    let ci = 0;
    for (const w of line.words) {
      const p = Lyrics.wordProgress(w, t);
      c.fillStyle = p > 0 ? rgba('paper', 0.55) : rgba('mist', 0.35 * vis);
      c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size, 1.5), y0);
      ci += Array.from(w.w).length + 1;
    }
    c.restore();
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t;

    const crack = this.crackAt(t);
    const tremor = crack > 0 ? (Math.sin(t * 53) * 0.5 + Math.sin(t * 71 + 1.7) * 0.5) * crack * 2.2 : 0;
    // a slow continuous drift: the frame is never quite dead-still, even before anything "happens"
    const driftX = Math.sin(t * 0.21) * 7, driftY = Math.cos(t * 0.16) * 5;

    const u = this.bg.u;
    u.uT!.value = t;
    (u.uMaskC!.value as THREE.Vector2).set(MASK_X + tremor + driftX, MASK_Y + driftY);
    u.uTremor!.value = tremor;
    this.bg.render(renderer, out);

    const L = this.layer; L.clear();
    const c = L.ctx;
    c.setTransform(1, 0, 0, 1, driftX * 0.6, driftY * 0.6);

    // GR meter: pinned near max for most of the scene; only flickers once the flatline cracks.
    const gx = W - 150, gy0 = 260, gy1 = 760;
    c.strokeStyle = rgba('mist', 0.6);
    c.strokeRect(gx, gy0, 40, gy1 - gy0);
    const pinned = 0.92 - 0.1 * crack * (0.5 + 0.5 * Math.sin(t * 19));
    const fillY = lerp(gy0, gy1, 1 - pinned);
    c.fillStyle = rgba('paper', 0.55);
    c.fillRect(gx, fillY, 40, gy1 - fillY);
    c.font = font(F.mono(400), 14);
    c.fillStyle = rgba('mist', 0.7);
    c.textAlign = 'center';
    c.fillText('GR', gx + 20, gy0 - 16);
    c.fillText(`-${(pinned * 30).toFixed(1)}dB`, gx + 20, gy1 + 22);

    // lyric: one line at a time, Archivo 300, each with its own choreography
    const line = this.lines.find((l) => t >= l.start - 0.5 && t < l.end + 0.4) ?? null;
    if (line) {
      const fam = F.archivo(100, 300);
      const size = 74;
      c.font = font(fam, size);
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      const x0 = MASK_X - MASK_R * 0.1, y0 = 840;
      const draw = [this.drawLine1, this.drawLine2, this.drawLine3, this.drawLine4][this.lines.indexOf(line)]!;
      draw.call(this, c, t, line, fam, size, x0, y0);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    comp.draw(renderer, L.upload(), out);

    // ---- the flatline: dead flat through the sung lines; real bass/kick signal leaks in as `crack` rises
    const Tr = this.trace; Tr.clear();
    const idle: [number, number, number] = [lerp(LIN.mist[0], LIN.paper[0], 0.4), lerp(LIN.mist[1], LIN.paper[1], 0.4), lerp(LIN.mist[2], LIN.paper[2], 0.4)];
    let prevX = 0, prevY = TRACE_Y;
    for (let i = 0; i <= N; i++) {
      const u2 = i / N;
      const x = lerp(TRACE_X0, TRACE_X1, u2) + driftX;
      const tx = t - (1 - u2) * 1.6;
      const buzz = Math.sin(tx * 240) * 0.6;
      const spike = spikeAmount(au, tx, 0.04) * crack;
      const duck = duckAmount(au, tx, { depth: crack });
      const y = TRACE_Y + driftY + buzz - spike * 70 + duck * 55;
      const act = clamp((spike + duck * 0.6) * crack);
      const rgb: [number, number, number] = [lerp(idle[0], 1.4, act), lerp(idle[1], 1.4, act), lerp(idle[2], 1.4, act)];
      if (i > 0) Tr.seg2(prevX, prevY, x, y, 2.6, rgb, 1);
      prevX = x; prevY = y;
    }
    Tr.render(renderer, out);

    return {
      exposure: 1.05,
      bloom: 0.12 + 0.35 * crack,
      bloomThreshold: lerp(0.88, 0.55, crack),
      halation: 0,
      vignette: 0.22,
      grain: 0.035,
      shake: [tremor * 0.4, 0],
      zoom: 1 + 0.006 * Math.sin(t * 0.3),
    };
  }
}
