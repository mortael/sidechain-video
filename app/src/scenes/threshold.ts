// `threshold` — prechorus 1 & 2, "Waits for the drop" / "Pressure building in the mix". A
// compressor transfer-function graph (n=1) or a multitrack meter bridge (n=2) stays on screen
// as the in-world instrument throughout, the frame itself squeezing vertically as pressure
// builds toward the chorus. Still black-and-paper: colour only teases in during the last
// moment before the cut into `duck`.
//
// Each of the four lines per half gets its own distinct kinetic treatment (see the per-line
// choreography reference the user supplied, translated out of literal UI icons into this
// project's own vocabulary — nodes/connections, a scanning playhead, meter erosion, a compressor
// stack — rather than copied mute-icons/spinners/chat-bubbles):
//  n=1: L1 "My chest gets quiet" — small and nearly still, boxed by jittery loudness noise at the
//       frame edges; L2 "I fade myself" — a brightness staircase down per word, snapping back on
//       "survive"; L3 "Every truth I try to hide" — words as graph nodes with connecting lines,
//       each masked down to a bare point once sung; L4 "Waits for the drop" — a playhead scans
//       toward centre, freezes, "come alive" flashes once in the gradient's hottest value.
//  n=2: L1 "Pressure building in the mix" — vertical lines stack and tighten around the squeezed
//       type; L2 "I'm fading fast beneath the kicks" — real kicks progressively erode the letters;
//       L3 "Hold my breath until it hits" — words freeze one at a time, a small rotating tick-ring
//       marks the held breath; L4 "Then every buried feeling slips" — kicks launch fragments up
//       from the bottom edge while "feeling" stretches vertically and the meter-bridge fader slips.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba, gradientRgba, gradientLin } from '../engine/palette';
import { F, font, glyphX } from '../engine/type';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { clamp, lerp, prog, ease, noise1, pulse, hash, TAU } from '../engine/util';
import { duckAmount, spikeAmount, recentKicks } from './_signal';

const CX = W / 2, CY = H / 2;

export default class ThresholdScene extends Scene {
  layer = new Layer2D();
  fx = new LineBatch(400, { blend: 'add' });
  lines: Line[] = [];
  n = 1;

  override async init() {
    const ly = this.ctx.lyrics;
    this.n = (this.ctx.params.n as number) ?? 1;
    this.lines = this.n === 1
      ? [ly.get('My chest gets quiet'), ly.get('I fade myself'), ly.get('Every truth I try'), ly.get('Waits for the drop')]
      : [ly.get('Pressure building in the mix'), ly.get("I'm fading fast"), ly.get('Hold my breath'), ly.get('Then every buried feeling slips')];
  }

  /** Draw at (x,y) as if the whole frame were squeezed vertically toward centre by `amt` (0..1),
   * plus a slow continuous drift so the frame is never perfectly static. */
  squeeze(c: CanvasRenderingContext2D, amt: number, driftX: number, driftY: number) {
    c.setTransform(1, 0, 0, 1 - 0.22 * amt, driftX, CY * 0.22 * amt + driftY);
  }

  drawGR(c: CanvasRenderingContext2D, v: number, colorPhase: number, tease: number) {
    const gx = W - 150, gy0 = 260, gy1 = 760;
    c.strokeStyle = rgba('mist', 0.6);
    c.strokeRect(gx, gy0, 40, gy1 - gy0);
    const fillY = lerp(gy0, gy1, 1 - clamp(v));
    c.fillStyle = rgba('paper', 0.6 * (1 - tease));
    c.fillRect(gx, fillY, 40, gy1 - fillY);
    if (tease > 0.001) {
      c.fillStyle = gradientRgba(colorPhase, 0.8 * tease);
      c.fillRect(gx, fillY, 40, gy1 - fillY);
    }
    c.font = font(F.mono(400), 14);
    c.fillStyle = rgba('mist', 0.7);
    c.textAlign = 'center';
    c.fillText('GR', gx + 20, gy0 - 16);
    c.fillText(`-${(v * 30).toFixed(1)}dB`, gx + 20, gy1 + 22);
  }

  /** n=1: a compressor transfer-function graph, the input marker climbing toward threshold. */
  drawCompressorGraph(c: CanvasRenderingContext2D, t: number, level: number) {
    const x0 = 300, x1 = 1020, y0 = 860, y1 = 220;
    const THRESH = 0.72;
    const RATIO = 4;
    const out = (x: number) => (x < THRESH ? x : THRESH + (x - THRESH) / RATIO);
    c.strokeStyle = rgba('mist', 0.5);
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y1); c.lineTo(x1, y1); c.stroke();
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.stroke();
    c.save(); c.setLineDash([5, 6]); c.strokeStyle = rgba('mist', 0.3);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0 - (x1 - x0)); c.stroke(); c.restore();
    c.strokeStyle = rgba('paper', 0.9);
    c.lineWidth = 2.5;
    c.beginPath();
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      const px = x0 + u * (x1 - x0);
      const py = y0 - out(u) * (y0 - y1);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const tx = x0 + THRESH * (x1 - x0), ty = y0 - out(THRESH) * (y0 - y1);
    c.save(); c.setLineDash([4, 5]); c.strokeStyle = rgba('mist', 0.5);
    c.beginPath(); c.moveTo(tx, y0); c.lineTo(tx, ty); c.stroke(); c.restore();
    c.font = font(F.mono(400), 15);
    c.fillStyle = rgba('mist', 0.75);
    c.textAlign = 'left';
    c.fillText('THRESH -18dB · RATIO 4:1', x0, y1 - 20);
    const lx = x0 + clamp(level) * (x1 - x0), ly2 = y0 - out(clamp(level)) * (y0 - y1);
    c.beginPath(); c.arc(lx, ly2, 7, 0, Math.PI * 2);
    c.fillStyle = rgba('paper', 1);
    c.fill();
  }

  /** n=2: a meter bridge, one fader visibly slipping right on the word "slips". */
  drawMeterBridge(c: CanvasRenderingContext2D, t: number, level: number) {
    const chans = 6;
    const x0 = 360, x1 = W - 360, y0 = 780, y1 = 260;
    const slipWord = this.lines[3]!.words[this.lines[3]!.words.length - 1]!;
    for (let i = 0; i < chans; i++) {
      const x = lerp(x0, x1, i / (chans - 1));
      const wobble = noise1(t * 0.9 + i * 11, i) * 0.12;
      let v = clamp(level * (0.6 + 0.4 * ((i * 37) % 7) / 6) + wobble);
      if (i === 2) {
        const slip = prog(t, slipWord.start - 0.02, slipWord.start + 0.22, ease.outCubic) * (1 - prog(t, slipWord.start + 0.5, slipWord.start + 0.9));
        v = lerp(v, v * 0.22, slip);
      }
      c.strokeStyle = rgba('mist', 0.5);
      c.strokeRect(x - 14, y1, 28, y0 - y1);
      const fy = lerp(y0, y1, v);
      c.fillStyle = rgba('paper', 0.65);
      c.fillRect(x - 14, fy, 28, y0 - fy);
      c.font = font(F.mono(400), 12);
      c.fillStyle = rgba('mist', 0.6);
      c.textAlign = 'center';
      c.fillText(`CH${i + 1}`, x, y0 + 20);
    }
  }

  // ---------------------------------------------------------------- n=1 per-line choreography

  /** L1: small and nearly still — a quiet centre boxed in by jittery loudness noise at the edges. */
  n1_L1(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number) {
    const { audio: au } = this.ctx;
    const vis = prog(t, line.start - 0.45, line.start);
    const loud = au.env('other', t) + au.env('rms', t) * 0.6;
    const F2 = this.fx;
    for (let i = 0; i < 40; i++) {
      const edge = i % 4;
      const u = noise1(t * 2.1 + i * 7.3, i);
      const along = ((i * 53) % 97) / 97;
      let x0_ = 0, y0_ = 0, x1_ = 0, y1_ = 0;
      const jit = loud * 26 * u;
      if (edge === 0) { x0_ = along * W; y0_ = 40 + jit; x1_ = x0_; y1_ = y0_ + 14; }
      else if (edge === 1) { x0_ = along * W; y0_ = H - 40 - jit; x1_ = x0_; y1_ = y0_ - 14; }
      else if (edge === 2) { x0_ = 40 + jit; y0_ = along * H; x1_ = x0_ + 14; y1_ = y0_; }
      else { x0_ = W - 40 - jit; y0_ = along * H; x1_ = x0_ - 14; y1_ = y0_; }
      F2.seg2(x0_, y0_, x1_, y1_, 1.8, LIN.mist, 0.3 + 0.45 * clamp(loud));
    }
    c.font = font(fam, size * 0.72);
    c.textAlign = 'center';
    c.fillStyle = rgba('paper', 0.8 * vis);
    const ty = CY + 60 + Math.sin(t * 1.3) * 2; // barely, barely moving
    c.fillText(line.text.toLowerCase(), CX, ty);
  }

  /** L2: a brightness staircase descending word by word, snapping back to full on "survive". */
  n1_L2(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, x0: number, y0: number) {
    const vis = prog(t, line.start - 0.45, line.start);
    c.font = font(fam, size);
    c.textAlign = 'left';
    let ci = 0;
    const steps = [1, 0.7, 0.5, 0.25, 0.25, 0.06];
    for (let i = 0; i < line.words.length; i++) {
      const w = line.words[i]!;
      const p = Lyrics.wordProgress(w, t);
      const isLast = i === line.words.length - 1;
      const snap = isLast ? prog(t, w.start, w.start + 0.1) : 0;
      const level = lerp(steps[Math.min(i, steps.length - 1)]!, 1, snap);
      c.fillStyle = p > 0 ? rgba('paper', 0.95 * level) : rgba('mist', 0.45 * vis);
      c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size, 1.2), y0);
      ci += Array.from(w.w).length + 1;
    }
  }

  /** L3: each word is a graph node; nodes connect, then get masked down to a bare point once sung. */
  n1_L3(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number) {
    const nodeY = 760, nx0 = 340, nx1 = W - 340;
    const n = line.words.length;
    const pos = line.words.map((_, i) => lerp(nx0, nx1, n > 1 ? i / (n - 1) : 0.5));
    const F2 = this.fx;
    for (let i = 0; i < n - 1; i++) F2.seg2(pos[i]!, nodeY, pos[i + 1]!, nodeY, 1.3, LIN.mist, 0.3);
    c.font = font(fam, size * 0.78);
    c.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      const w = line.words[i]!;
      const p = Lyrics.wordProgress(w, t);
      const mask = prog(t, w.end + 0.05, w.end + 0.4);
      const lit = p > 0;
      const dotR = lerp(3, 6, mask);
      F2.seg2(pos[i]!, nodeY, pos[i]! + 0.01, nodeY, dotR, lit ? LIN.paper : LIN.mist, lerp(0.5, 1, lit ? 1 : 0.4));
      c.globalAlpha = 1 - mask;
      c.fillStyle = lit ? rgba('paper', 0.9) : rgba('mist', 0.5);
      c.fillText(w.w, pos[i]!, nodeY - 26);
      c.globalAlpha = 1;
      if (mask > 0.001) {
        c.fillStyle = rgba('ink', mask);
        const tw = c.measureText(w.w).width;
        c.fillRect(pos[i]! - tw / 2 - 8, nodeY - 48, tw + 16, 34);
      }
    }
  }

  /** L4: a playhead scans toward centre, freezes, "come alive" flashes once in the hottest colour. */
  n1_L4(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, colorPhase: number) {
    const dropW = line.words.find((w) => w.w.toLowerCase().startsWith('drop'))!;
    const aliveW = line.words[line.words.length - 1]!;
    const scanP = clamp(prog(t, line.start, dropW.start));
    const px = lerp(140, CX, scanP);
    const F2 = this.fx;
    F2.seg2(px, 240, px, 840, 2, LIN.mist, 0.5);
    c.font = font(fam, size * 0.85);
    c.textAlign = 'center';
    const label = Lyrics.wordProgress(dropW, t) > 0 ? 'FOR THE DROP' : 'WAITING...';
    c.fillStyle = rgba('mist', 0.75);
    c.fillText(label, CX, 540);
    const flash = pulse(t, aliveW.start, 0.14);
    if (flash > 0.01) {
      c.fillStyle = gradientRgba(0, Math.min(1, flash * 1.4)); // bright cyan: the hottest value for this half's range
      c.font = font(F.archivo(100, 700), size * 1.2);
      c.fillText('COME ALIVE', CX, 440);
    }
  }

  // ---------------------------------------------------------------- n=2 per-line choreography

  /** L1: vertical lines stack and tighten around the type as pressure builds across the line. */
  n2_L1(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, x0: number, y0: number) {
    const built = prog(t, line.start, line.end);
    const nLines = Math.round(lerp(4, 16, built));
    const spacing = lerp(100, 20, built);
    const pivot = x0 + 380; // centred on the lyric itself, not the frame
    const F2 = this.fx;
    for (let i = 0; i < nLines; i++) {
      const x = pivot + (i - (nLines - 1) / 2) * spacing;
      F2.seg2(x, 300, x, 820, 1.1, LIN.mist, lerp(0.12, 0.3, built));
    }
    c.font = font(fam, size);
    c.textAlign = 'left';
    const sx = lerp(1, 1.1, built), sy = lerp(1, 0.6, built);
    let ci = 0;
    const vis = prog(t, line.start - 0.45, line.start);
    for (const w of line.words) {
      const p = Lyrics.wordProgress(w, t);
      const wx = x0 + glyphX(line.text, ci, fam, size, 1.2);
      c.save();
      c.translate(wx, y0);
      c.scale(sx, sy);
      c.fillStyle = p > 0 ? rgba('paper', 0.95) : rgba('mist', 0.45 * vis);
      c.fillText(w.w, 0, 0);
      c.restore();
      ci += Array.from(w.w).length + 1;
    }
  }

  /** L2: real kicks since this line started progressively erode the letters. */
  n2_L2(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, x0: number, y0: number) {
    const { audio: au } = this.ctx;
    const kicks = recentKicks(au, t, Math.max(0.001, t - line.start)).filter(([dt]) => dt >= 0).length;
    const erosionTable = [0, 0.1, 0.3, 0.6, 0.95];
    const erosion = erosionTable[Math.min(kicks, 4)]!;
    c.font = font(fam, size);
    c.textAlign = 'left';
    const vis = prog(t, line.start - 0.45, line.start);
    let ci = 0;
    for (const w of line.words) {
      const p = Lyrics.wordProgress(w, t);
      let cj = ci;
      for (const ch of Array.from(w.w)) {
        if (hash(cj, 7) < erosion) { cj++; continue; } // eroded: skip this glyph entirely
        c.fillStyle = p > 0 ? rgba('paper', 0.95) : rgba('mist', 0.45 * vis);
        c.fillText(ch, x0 + glyphX(line.text, cj, fam, size, 1.2), y0);
        cj++;
      }
      ci += Array.from(w.w).length + 1;
    }
  }

  /** L3: words freeze one at a time; a small rotating tick-ring marks the held breath. */
  n2_L3(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, x0: number, y0: number) {
    const untilW = line.words.find((w) => w.w.toLowerCase().startsWith('until'))!;
    const hitsW = line.words[line.words.length - 1]!;
    c.font = font(fam, size);
    c.textAlign = 'left';
    const vis = prog(t, line.start - 0.45, line.start);
    let ci = 0;
    for (const w of line.words) {
      if (w.start > t + 0.02 && w !== untilW) break; // not yet reached: freeze here (sequential reveal)
      const p = Lyrics.wordProgress(w, t);
      const suffix = w === untilW && t >= untilW.start ? ' ...' : '';
      c.fillStyle = p > 0 ? rgba('paper', 0.95) : rgba('mist', 0.45 * vis);
      c.fillText(w.w + suffix, x0 + glyphX(line.text, ci, fam, size, 1.2), y0);
      ci += Array.from(w.w).length + 1;
    }
    const waiting = t >= untilW.start && t < hitsW.start;
    if (waiting) {
      const rx = x0 + 760, ry = y0 - 20;
      const F2 = this.fx;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + t * 2.6;
        const r0 = 14, r1 = 20;
        F2.seg2(rx + Math.cos(a) * r0, ry + Math.sin(a) * r0, rx + Math.cos(a) * r1, ry + Math.sin(a) * r1, 2, LIN.mist, 0.5);
      }
    }
  }

  /** L4: on the kick release, fragments launch up from the bottom edge; "feeling" stretches vertically. */
  n2_L4(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, x0: number, y0: number, colorPhase: number) {
    const { audio: au } = this.ctx;
    const feelingW = line.words.find((w) => w.w.toLowerCase().startsWith('feeling'))!;
    const F2 = this.fx;
    const lit = gradientLin(colorPhase);
    for (const [dt, strength] of recentKicks(au, t, 0.5)) {
      if (dt < 0) continue;
      const tk = t - dt;
      for (let j = 0; j < 5; j++) {
        const seed = hash(Math.round(tk * 1000), j);
        const age = dt + seed * 0.04;
        if (age > 0.45) continue;
        const fx_ = lerp(x0 - 80, x0 + 900, seed);
        const fy = H - 60 - age * 420 * (0.5 + strength);
        const a = (1 - age / 0.45) * strength;
        F2.seg2(fx_, fy, fx_, fy - 16, 2, [lit[0] * 1.3, lit[1] * 1.3, lit[2] * 1.3], a * 0.8);
      }
    }
    c.font = font(fam, size);
    c.textAlign = 'left';
    const vis = prog(t, line.start - 0.45, line.start);
    const release = 1 - duckAmount(au, t, { depth: 1 });
    let ci = 0;
    let extra = 0; // extra width "feeling" has consumed by spreading its own letters apart
    for (const w of line.words) {
      const p = Lyrics.wordProgress(w, t);
      const wx = x0 + glyphX(line.text, ci, fam, size, 1.2) + extra;
      c.fillStyle = p > 0 ? rgba('paper', 0.95) : rgba('mist', 0.45 * vis);
      if (w === feelingW) {
        const sy = lerp(1, 1.6, release);
        const spread = lerp(0, 16, release);
        let lx = wx;
        for (const ch of Array.from(w.w)) {
          c.save();
          c.translate(lx, y0 - size * 0.3 * (sy - 1));
          c.scale(1, sy);
          c.fillText(ch, 0, 0);
          c.restore();
          lx += c.measureText(ch).width + spread;
        }
        extra += spread * (Array.from(w.w).length - 1);
      } else {
        c.fillText(w.w, wx, y0);
      }
      ci += Array.from(w.w).length + 1;
    }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.black);

    const squeezeAmt = ease.inQuad(f.p);
    const level = clamp(au.env('rms', t) * 0.7 + au.env('bass', t) * 0.5 + f.p * 0.25);
    const tease = prog(t, this.ctx.end - 1.0, this.ctx.end);
    const colorPhase = this.n === 1 ? 0.18 : 0.3;
    const driftX = Math.sin(t * 0.19) * 6, driftY = Math.cos(t * 0.15) * 4;

    const L = this.layer; L.clear();
    const c = L.ctx;
    this.squeeze(c, squeezeAmt, driftX, driftY);
    if (this.n === 1) this.drawCompressorGraph(c, t, level);
    else this.drawMeterBridge(c, t, level);
    this.drawGR(c, level, colorPhase, tease);

    this.fx.clear();
    const line = this.lines.find((l) => t >= l.start - 0.5 && t < l.end + 0.4) ?? null;
    const idx = line ? this.lines.indexOf(line) : -1;
    const x0 = 300, y0 = 970, fam = F.archivo(100, 300), size = 60;
    if (line) {
      if (this.n === 1) {
        if (idx === 0) this.n1_L1(c, t, line, fam, size);
        else if (idx === 1) this.n1_L2(c, t, line, fam, size, x0, y0);
        else if (idx === 2) this.n1_L3(c, t, line, fam, size);
        else this.n1_L4(c, t, line, fam, size, colorPhase);
      } else {
        if (idx === 0) this.n2_L1(c, t, line, fam, size, x0, y0);
        else if (idx === 1) this.n2_L2(c, t, line, fam, size, x0, y0);
        else if (idx === 2) this.n2_L3(c, t, line, fam, size, x0, y0);
        else this.n2_L4(c, t, line, fam, size, x0, y0, colorPhase);
      }
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    comp.draw(renderer, L.upload(), out);
    this.fx.render(renderer, out);

    return {
      exposure: 1.05,
      bloom: 0.15 + 0.3 * tease,
      bloomThreshold: lerp(0.88, 0.55, tease),
      halation: 0,
      vignette: 0.24 + 0.1 * squeezeAmt,
      grain: 0.035,
      zoom: 1 + 0.006 * Math.sin(t * 0.27),
    };
  }
}
