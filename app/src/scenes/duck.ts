// `duck` — the hook, choruses 1-3: "I don't break till the kick comes through... I only cry in
// sidechain". The showpiece: the whole frame ducks on every kick and springs back, colour
// flooding in only on the release. Escalates across the three choruses (see docs/TREATMENT.md):
// duck1 clean and controlled, duck2 harder with more colour bleeding through, duck3 failing to
// fully recover between hits (the overflow arriving early, before the bridge's literal one).
//
// Each lyric line gets its own treatment rather than one repeated karaoke template (per-line
// choreography reference the user supplied, translated out of literal UI cues): "I don't break"
// shoves its words apart on every kick and snaps back — duck3 instead refuses the usual frame
// squeeze and cracks the screen open vertically; "my heart ducks low" dips two words under a
// baseline beside a compressing heart-ring; "when the silence" is a near-blank frame with one
// small word that sets off expanding rings; "that's the moment" flashes and vanishes, leaving
// "you" glowing with a pulsing point; the hook itself gains a compressor-envelope trace running
// under the type; chorus1's tag line pulses CRY full-size while "IN SIDECHAIN" drifts through the
// background like metadata; chorus3's two unique lines (no silence/moment here) build a fragment
// cloud of earlier buried words, then turn that cloud into a sweeping waveform.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba, gradientRgba, gradientLin } from '../engine/palette';
import { F, font, glyphX, measure } from '../engine/type';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { clamp, lerp, prog, ease, pulse, hash, fract, TAU } from '../engine/util';
import type { AudioData } from '../engine/audio';
import { duckAmount, spikeAmount, dropletAt, recentKicks } from './_signal';

const CX = W / 2, CY = H / 2;
const DELAY = 0.02, DIP_TIME = 0.12;

const CONFIG = [
  null,
  { colorPhase: 0.08, squeeze: 0.16, glowBase: 0.5, fail: 0 }, // duck1: cyan/sky
  { colorPhase: 0.42, squeeze: 0.24, glowBase: 0.75, fail: 0.3 }, // duck2: blue/violet
  { colorPhase: 0.78, squeeze: 0.3, glowBase: 1.0, fail: 0.7 }, // duck3: violet/magenta, fails to recover
] as const;
type Cfg = Exclude<(typeof CONFIG)[number], null>;

const CLOUD_FRAGMENTS = ['NEVER', 'SAY', 'WORDS', 'HIDDEN', 'UNSAID', 'QUIET', 'STAY', "DON'T"];
const WAVE_ECHOES = ['DAYLIGHT', 'MUTED', 'HIDE', 'ALONE', 'BREATH', 'CONTROL', 'CRY'];

export default class DuckScene extends Scene {
  layer = new Layer2D();
  fx = new LineBatch(2000, { blend: 'add' });
  lines: Line[] = [];
  n = 1;

  override async init() {
    const ly = this.ctx.lyrics;
    this.n = (this.ctx.params.n as number) ?? 1;
    const idx = this.n - 1;
    const common = [
      ly.get("I don't break till the kick comes through", idx),
      ly.get('My heart ducks low', idx),
    ];
    if (this.n === 3) {
      this.lines = [...common, ly.get('All the things I never say'), ly.get('Rush back in with every wave'), ly.get('I only cry in sidechain', 2)];
    } else {
      this.lines = [
        ...common,
        ly.get('When the silence starts to move', idx),
        ly.get("That's the moment I feel you", idx),
        ly.get('I only cry in sidechain', idx),
        ...(this.n === 1 ? [ly.get('Cry in sidechain', 0)] : []),
      ];
    }
  }

  wordFill(w: Word, t: number, cfg: Cfg, vis: number): string {
    const p = Lyrics.wordProgress(w, t);
    return p > 0 ? (p < 1 ? gradientRgba(cfg.colorPhase, 1) : rgba('paper', 1)) : rgba('mist', 0.4 * vis);
  }

  /** "I don't break till the kick comes through": words shove apart on each kick, snap back.
   * duck3 refuses the usual frame squeeze here and cracks the screen open vertically instead. */
  drawBreak(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, cfg: Cfg, vis: number, spike: number) {
    c.font = font(fam, size);
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    const total = measure(line.text, fam, size, 1);
    const x0 = (W - total) / 2;
    let ci = 0;
    for (let i = 0; i < line.words.length; i++) {
      const w = line.words[i]!;
      const hit = pulse(t, w.start, 0.15);
      const shove = (i % 2 === 0 ? -1 : 1) * spike * (this.n === 3 ? 4 : 20);
      c.save();
      if (hit > 0.01) { const s = 1 + 0.08 * hit; c.translate(CX, CY); c.scale(s, s); c.translate(-CX, -CY); }
      c.translate(shove, 0);
      c.fillStyle = this.wordFill(w, t, cfg, vis);
      c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size, 1), CY);
      c.restore();
      ci += Array.from(w.w).length + 1;
    }
    if (this.n === 3) {
      const crack = 6 + spike * 90;
      const F2 = this.fx;
      F2.seg2(CX - crack, 0, CX - crack, H, 2, LIN.mist, 0.25 + 0.5 * spike);
      F2.seg2(CX + crack, 0, CX + crack, H, 2, LIN.mist, 0.25 + 0.5 * spike);
    }
  }

  /** "My heart ducks low just like the groove": a compressing heart-ring above the line;
   * "ducks" and "low" physically dip under a horizontal baseline the rest of the words sit on. */
  drawHeart(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, cfg: Cfg, vis: number, duck: number) {
    c.font = font(fam, size);
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    const total = measure(line.text, fam, size, 1);
    const x0 = (W - total) / 2;
    const ringY = CY - 150 + duck * 34, ringR = 46 - duck * 10;
    const F2 = this.fx;
    const lit = gradientLin(cfg.colorPhase);
    let pa = 0, pb = 0;
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU;
      const x = CX + Math.cos(a) * ringR, y = ringY + Math.sin(a) * ringR * 0.8;
      if (i > 0) F2.seg2(pa, pb, x, y, 1.8, lit, 0.55);
      pa = x; pb = y;
    }
    let ci = 0;
    for (const w of line.words) {
      const isDip = /ducks|low/i.test(w.w);
      const dipY = isDip ? duck * 30 : 0;
      c.fillStyle = this.wordFill(w, t, cfg, vis);
      c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size, 1), CY + dipY);
      ci += Array.from(w.w).length + 1;
    }
    c.strokeStyle = rgba('mist', 0.3);
    c.beginPath(); c.moveTo(x0 - 30, CY + 48); c.lineTo(x0 + total + 30, CY + 48); c.stroke();
  }

  /** "When the silence starts to move": a near-blank frame, one small steady word, which sets
   * off slow concentric rings traveling outward once it begins (per the script) "to vibrate". */
  drawSilence(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, cfg: Cfg, vis: number) {
    const sw = line.words.find((w) => /silence/i.test(w.w))!;
    const since = Math.max(0, t - sw.start);
    c.font = font(fam, size * 0.48);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = this.wordFill(sw, t, cfg, vis);
    c.fillText(sw.w, CX, CY);
    if (since > 0.08) {
      const F2 = this.fx;
      for (let k = 0; k < 3; k++) {
        const age = since - k * 0.4;
        if (age < 0) continue;
        const r = 40 + age * 180;
        const a = Math.max(0, 0.55 - age * 0.22);
        if (a <= 0) continue;
        let pa = 0, pb = 0;
        for (let i = 0; i <= 48; i++) {
          const an = (i / 48) * TAU;
          const x = CX + Math.cos(an) * r, y = CY + Math.sin(an) * r * 0.56;
          if (i > 0) F2.seg2(pa, pb, x, y, 1.2, LIN.mist, a);
          pa = x; pb = y;
        }
      }
    }
    // the rest of the line, tiny and dim, so the karaoke sync is still honest without breaking the hush
    c.font = font(fam, size * 0.22);
    c.fillStyle = rgba('mist', 0.3 * vis);
    c.fillText(line.text, CX, CY + 150);
  }

  /** "That's the moment I feel you": the first clause flashes then vanishes; "you" persists,
   * glowing, with a small point inside it that pulses with the duck. */
  drawMoment(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, cfg: Cfg, vis: number, duck: number) {
    c.font = font(fam, size);
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    const total = measure(line.text, fam, size, 1);
    const x0 = (W - total) / 2;
    const momentW = line.words.find((w) => /moment/i.test(w.w))!;
    const youW = line.words[line.words.length - 1]!;
    const vanish = prog(t, momentW.end, momentW.end + 0.4, ease.inCubic);
    let ci = 0, youX = x0;
    for (const w of line.words) {
      const isYou = w === youW;
      if (isYou) youX = x0 + glyphX(line.text, ci, fam, size, 1);
      const a = isYou ? 1 : 1 - vanish;
      if (a > 0.004) {
        c.globalAlpha = a;
        c.fillStyle = isYou ? gradientRgba(cfg.colorPhase, 1) : this.wordFill(w, t, cfg, vis);
        c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size, 1), CY);
        c.globalAlpha = 1;
      }
      ci += Array.from(w.w).length + 1;
    }
    if (Lyrics.wordProgress(youW, t) > 0) {
      const F2 = this.fx;
      const r = 3 + 5 * duck;
      F2.seg2(youX + measure(youW.w, fam, size, 1) * 0.5, CY, youX + measure(youW.w, fam, size, 1) * 0.5 + 0.01, CY, r, gradientLin(cfg.colorPhase), 0.9);
    }
  }

  /** The hook itself: the existing big-type karaoke treatment, plus a thin compressor-envelope
   * trace running under the typography, ducking with the real kick. */
  drawHook(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, cfg: Cfg, vis: number, duck: number) {
    c.font = font(fam, size);
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    const total = measure(line.text, fam, size, 1);
    const x0 = (W - total) / 2;
    let ci = 0;
    for (const w of line.words) {
      const hit = pulse(t, w.start, 0.15);
      c.save();
      if (hit > 0.01) { const s = 1 + 0.08 * hit; c.translate(CX, CY); c.scale(s, s); c.translate(-CX, -CY); }
      c.fillStyle = this.wordFill(w, t, cfg, vis);
      c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size, 1), CY);
      c.restore();
      ci += Array.from(w.w).length + 1;
    }
    const F2 = this.fx;
    const yBase = CY + size * 0.72, lit = gradientLin(cfg.colorPhase);
    let pa = 0, pb = yBase;
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = x0 + u * total;
      const y = yBase - Math.sin(u * 11 - t * 4.2) * 6 - duck * 16;
      if (i > 0) F2.seg2(pa, pb, x, y, 1.6, lit, 0.5);
      pa = x; pb = y;
    }
  }

  /** "Cry in sidechain" (chorus 1's tag): CRY pulses full-size with the frame's own duck;
   * "IN SIDECHAIN" drifts through the background repeatedly, like technical metadata. */
  drawCryOutro(c: CanvasRenderingContext2D, t: number, line: Line, cfg: Cfg) {
    const cryW = line.words[0]!;
    c.font = font(F.archivo(100, 900), 190);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = Lyrics.wordProgress(cryW, t) > 0 ? gradientRgba(cfg.colorPhase, 1) : rgba('mist', 0.4);
    c.fillText('CRY', CX, CY - 30);
    c.font = font(F.mono(500), 22);
    c.fillStyle = rgba('mist', 0.3);
    c.textAlign = 'left';
    const step = W + 400;
    const drift = ((t * 44) % step) - 400;
    c.fillText('IN SIDECHAIN', drift, CY + 170);
    c.fillText('IN SIDECHAIN', drift - step, CY + 170);
  }

  /** "All the things I never say" (chorus 3 only, no silence/moment pair here): the clause
   * itself stays centred and steady while buried synonyms scatter in and fade around it. */
  drawCloud(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, cfg: Cfg, vis: number) {
    const since = Math.max(0, t - line.start);
    c.font = font(F.mono(500), 23);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let i = 0; i < CLOUD_FRAGMENTS.length; i++) {
      const seed = i + 1;
      const appear = hash(seed, 3) * 0.9;
      if (since < appear) continue;
      const age = since - appear;
      const a = Math.min(1, age * 3) * Math.max(0, 1 - age * 0.35);
      if (a <= 0.003) continue;
      const x = W * 0.18 + hash(seed, 1) * W * 0.64;
      const y = H * 0.22 + hash(seed, 2) * H * 0.56;
      c.fillStyle = rgba('mist', 0.5 * a);
      c.fillText(CLOUD_FRAGMENTS[i]!, x, y);
    }
    c.font = font(fam, size);
    c.textAlign = 'left';
    const total = measure(line.text, fam, size, 1);
    const x0 = (W - total) / 2;
    let ci = 0;
    for (const w of line.words) {
      c.fillStyle = this.wordFill(w, t, cfg, vis);
      c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size, 1), CY);
      ci += Array.from(w.w).length + 1;
    }
  }

  /** "Rush back in with every wave" (chorus 3 only): the cloud resolves into a sweeping
   * waveform, carrying brief flashes of earlier buried lyric fragments along its crest. */
  drawWaveCloud(c: CanvasRenderingContext2D, t: number, line: Line, fam: string, size: number, cfg: Cfg, vis: number, au: AudioData) {
    const F2 = this.fx;
    const rms = au.env('rms', t);
    const waveY = (u: number) => CY + Math.sin(u * 13 - t * 3.1) * 50 * (0.4 + rms);
    let pa = 0, pb = waveY(0);
    const N = 120;
    const lit = gradientLin(cfg.colorPhase);
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = u * W, y = waveY(u);
      if (i > 0) F2.seg2(pa, pb, x, y, 1.8, lit, 0.5);
      pa = x; pb = y;
    }
    c.font = font(F.mono(500), 25);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let i = 0; i < WAVE_ECHOES.length; i++) {
      const seed = i + 5;
      const u = fract(t * 0.13 + hash(seed, 1));
      const a = Math.sin(u * Math.PI);
      if (a <= 0.02) continue;
      c.fillStyle = rgba('mist', 0.45 * a);
      c.fillText(WAVE_ECHOES[i]!, u * W, waveY(u) - 34);
    }
    c.font = font(fam, size);
    c.textAlign = 'left';
    const total = measure(line.text, fam, size, 1);
    const x0 = (W - total) / 2;
    let ci = 0;
    for (const w of line.words) {
      c.fillStyle = this.wordFill(w, t, cfg, vis);
      c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size, 1), CY + 170);
      ci += Array.from(w.w).length + 1;
    }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t;
    const cfg = CONFIG[this.n]!;
    const progress = ease.inQuad(f.p);

    const duck = duckAmount(au, t, { depth: 1 });
    const spike = spikeAmount(au, t, 0.05);
    let glow = 0;
    for (const [dt] of recentKicks(au, t, 1.2)) glow = Math.max(glow, pulse(t, t - dt + DELAY + DIP_TIME, 0.22));
    const failFloor = cfg.fail * progress;
    const squeezeAmt = Math.max(duck, failFloor) * cfg.squeeze;
    const colorAmt = clamp(Math.max(glow * cfg.glowBase, failFloor));

    clearRT(renderer, out, LIN.black);

    const L = this.layer; L.clear();
    const c = L.ctx;
    if (colorAmt > 0.002) {
      c.fillStyle = gradientRgba(cfg.colorPhase, 0.5 * colorAmt);
      c.fillRect(0, 0, W, H);
    }

    const line = this.lines.find((l) => t >= l.start - 0.4 && t < l.end + 0.5) ?? null;
    const isBreak = line ? /don.t break/i.test(line.text) : false;
    const skipSqueeze = this.n === 3 && isBreak; // duck3's refusal: the screen cracks instead of ducking
    const sAmt = skipSqueeze ? 0 : squeezeAmt;
    c.setTransform(1, 0, 0, 1 - sAmt, 0, CY * sAmt);

    this.fx.clear();
    if (line) {
      const fam = F.archivo(100, 900);
      const size = 128;
      const vis = prog(t, line.start - 0.35, line.start);
      if (isBreak) this.drawBreak(c, t, line, fam, size, cfg, vis, spike);
      else if (/ducks low/i.test(line.text)) this.drawHeart(c, t, line, fam, size, cfg, vis, duck);
      else if (/silence starts/i.test(line.text)) this.drawSilence(c, t, line, fam, size, cfg, vis);
      else if (/the moment i feel you/i.test(line.text)) this.drawMoment(c, t, line, fam, size, cfg, vis, duck);
      else if (/^i only cry in sidechain/i.test(line.text)) this.drawHook(c, t, line, fam, size, cfg, vis, duck);
      else if (line.text.trim().toLowerCase() === 'cry in sidechain') this.drawCryOutro(c, t, line, cfg);
      else if (/never say/i.test(line.text)) this.drawCloud(c, t, line, fam, size, cfg, vis);
      else if (/rush back in/i.test(line.text)) this.drawWaveCloud(c, t, line, fam, size, cfg, vis, au);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);

    if (this.n >= 2) {
      const ratio = this.n === 2 ? Math.round(lerp(4, 16, progress)) : Math.round(lerp(16, 64, progress));
      c.font = font(F.mono(500), 20);
      c.fillStyle = rgba('mist', 0.7);
      c.textAlign = 'right';
      c.fillText(`RATIO ${ratio}:1`, W - 80, H - 70);
    }
    comp.draw(renderer, L.upload(), out);

    // ---- the trace's droplet, hanging off the frame's own duck (bottom-centre)
    const X = this.fx;
    const lit = gradientLin(cfg.colorPhase);
    for (const [dt] of recentKicks(au, t, 0.8)) {
      const drop = dropletAt(dt);
      if (drop.alpha <= 0.002) continue;
      const x = CX, y = H - 90 + drop.fallPx;
      const r = 4 + 6 * drop.grow;
      X.seg(x, y, 0, x + 1e-3, y, 0, r * 2, lit[0] * 1.8, lit[1] * 1.8, lit[2] * 1.8, drop.alpha * 0.9);
    }
    X.render(renderer, out);

    return {
      exposure: 1.1,
      bloom: 0.3 + 0.5 * colorAmt,
      bloomThreshold: lerp(0.8, 0.45, colorAmt),
      halation: 0,
      vignette: 0.22,
      grain: 0.04,
      zoom: 1 + 0.02 * spike,
      shake: [0, 6 * spike],
    };
  }
}
