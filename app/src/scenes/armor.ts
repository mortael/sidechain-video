// `armor` — verse 2, "Memes for armor". Ironic captions stack into a typographic wall (Plex
// Mono), a flat scope trace underneath still compressed — same suppressed state as `facade`, a
// different defense mechanism. A handwritten fragment flickers underneath for a frame or two —
// the real thought, instantly covered back up.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font, glyphX } from '../engine/type';
import { strokeText, drawStrokeText } from '../engine/stroke';
import { Lyrics, type Line } from '../engine/lyrics';
import { lerp, prog, pulse } from '../engine/util';

const TRACE_Y = 920;

export default class ArmorScene extends Scene {
  layer = new Layer2D();
  trace = new LineBatch(248, { blend: 'add' });
  lines: Line[] = [];
  flickerAt = 0;

  override async init() {
    const ly = this.ctx.lyrics;
    this.lines = [
      ly.get('I talk in jokes'),
      ly.get('Memes for armor'),
      ly.get('Every ache stays safely unknown'),
      ly.get("Till the bass reminds me I'm alone"),
    ];
    // the private thought surfaces once, in the gap after the second caption lands
    this.flickerAt = this.lines[1]!.end + 0.3;
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.black);

    const L = this.layer; L.clear();
    const c = L.ctx;

    // ---- the wall: every caption sung so far stacks up, Plex Mono, deadpan
    const fam = F.mono(500), size = 44;
    const rowH = 76;
    const shown = this.lines.filter((l) => t >= l.start - 0.3);
    const topY = 420 - (shown.length - 1) * rowH * 0.5;
    shown.forEach((line, i) => {
      const y = topY + i * rowH;
      const vis = prog(t, line.start - 0.3, line.start);
      c.font = font(fam, size);
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      let ci = 0;
      const x0 = 300;
      for (const w of line.words) {
        const p = Lyrics.wordProgress(w, t);
        c.fillStyle = p > 0 ? rgba('paper', 0.9 * vis) : rgba('mist', 0.4 * vis);
        c.fillText(w.w, x0 + glyphX(line.text, ci, fam, size, 1), y);
        ci += Array.from(w.w).length + 1;
      }
    });

    // ---- the real thought, handwritten, flickering once then gone
    const flicker = pulse(t, this.flickerAt, 0.06) * (t >= this.flickerAt ? 1 : 0);
    if (flicker > 0.02) {
      const st = strokeText('not fine', 'hscript', 52);
      c.save();
      c.translate(300, topY + shown.length * rowH + 40);
      c.strokeStyle = rgba('mist', 0.8 * flicker);
      c.lineWidth = 2;
      drawStrokeText(c, st, st.total);
      c.restore();
    }

    // ---- GR meter, pinned (same idiom as facade)
    const gx = W - 150, gy0 = 260, gy1 = 760;
    c.strokeStyle = rgba('mist', 0.6);
    c.strokeRect(gx, gy0, 40, gy1 - gy0);
    const pinned = 0.88;
    const fillY = lerp(gy0, gy1, 1 - pinned);
    c.fillStyle = rgba('paper', 0.5);
    c.fillRect(gx, fillY, 40, gy1 - fillY);
    c.font = font(F.mono(400), 14);
    c.fillStyle = rgba('mist', 0.7);
    c.textAlign = 'center';
    c.fillText('GR', gx + 20, gy0 - 16);
    comp.draw(renderer, L.upload(), out);

    // ---- the flatline, still compressed
    const Tr = this.trace; Tr.clear();
    const idle: [number, number, number] = [lerp(LIN.mist[0], LIN.paper[0], 0.35), lerp(LIN.mist[1], LIN.paper[1], 0.35), lerp(LIN.mist[2], LIN.paper[2], 0.35)];
    let prevX = 0, prevY = TRACE_Y;
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      const x = lerp(220, W - 220, u);
      const buzz = Math.sin((t - (1 - u) * 1.2) * 230) * 0.5;
      const y = TRACE_Y + buzz;
      if (i > 0) Tr.seg2(prevX, prevY, x, y, 2.2, idle, 1);
      prevX = x; prevY = y;
    }
    Tr.render(renderer, out);

    return {
      exposure: 1.05,
      bloom: 0.15,
      bloomThreshold: 0.85,
      halation: 0,
      vignette: 0.22,
      grain: 0.035,
    };
  }
}
