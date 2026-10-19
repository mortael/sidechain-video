// Shared motif: the sidechain-envelope trace and its droplet (see docs/TREATMENT.md).
// A duck is driven by a real kick onset: a sharp spike (the kick transient), a dip into
// negative gain reduction, then a release back to baseline — and a droplet that condenses
// at the bottom of the dip and falls free. Pure functions of time and the analysed kick
// onsets, so every scene reads the same shape without hand-placing kick times.
import type { AudioData } from '../engine/audio';
import { clamp, ease } from '../engine/util';

export interface DuckOpts {
  /** Delay (s) from the kick onset to the start of the dip (the spike comes first). */
  delay?: number;
  /** Time (s) for the dip to reach its deepest point. */
  dipTime?: number;
  /** Time (s) for the dip to recover back to baseline (the compressor's release). */
  release?: number;
  /** Scales the whole dip (0 = no duck). */
  depth?: number;
}

/** 0 (baseline) .. 1 (fully ducked) at time t, from the real kick onsets. */
export function duckAmount(au: AudioData, t: number, o: DuckOpts = {}): number {
  const { delay = 0.02, dipTime = 0.12, release = 0.3, depth = 1 } = o;
  let v = 0;
  for (const [tk, strength] of au.events('kick', t - delay - dipTime - release - 0.05, t + 0.01)) {
    const dt = t - tk;
    let d: number;
    if (dt < delay) d = 0;
    else if (dt < delay + dipTime) d = ease.outQuad((dt - delay) / dipTime);
    else d = Math.max(0, 1 - ease.outCubic((dt - delay - dipTime) / release));
    v = Math.max(v, d * strength);
  }
  return clamp(v) * depth;
}

/** The kick's own transient spike (0..1), independent of the dip: just the real kick hit pulse. */
export function spikeAmount(au: AudioData, t: number, halfLife = 0.05): number {
  return au.hit('kick', t, halfLife);
}

export interface DropletState {
  /** 0 while forming, 1 once fully condensed. */
  grow: number;
  /** px fallen since detaching (0 while still attached to the dip). */
  fallPx: number;
  /** 0..1 opacity (fades out as it falls). */
  alpha: number;
}

/** A droplet's lifecycle at `dt` seconds since the kick that spawned it: condenses at the bottom
 * of the dip, detaches, falls, fades. Mirrors the dip timing in `duckAmount` (same delay/dipTime). */
export function dropletAt(dt: number, o: DuckOpts & { hold?: number; fall?: number; gravity?: number } = {}): DropletState {
  const { delay = 0.02, dipTime = 0.12, hold = 0.05, fall = 0.3, gravity = 420 } = o;
  const formStart = delay + dipTime * 0.4;
  const formEnd = delay + dipTime + hold;
  if (dt < formStart) return { grow: 0, fallPx: 0, alpha: 0 };
  if (dt < formEnd) {
    const grow = clamp((dt - formStart) / (formEnd - formStart));
    return { grow, fallPx: 0, alpha: grow };
  }
  const f = clamp((dt - formEnd) / fall);
  return { grow: 1, fallPx: 0.5 * gravity * (dt - formEnd) * (dt - formEnd), alpha: 1 - f };
}

/** Every kick onset in range, as (dt = t - onsetTime, strength) pairs, most recent first. */
export function recentKicks(au: AudioData, t: number, lookback = 0.8): [number, number][] {
  return au.events('kick', t - lookback, t + 0.01).map(([tk, s]) => [t - tk, s] as [number, number]);
}

/** Net vertical displacement of the trace at song-time `tx` (spike up, duck down), -1..1ish. */
export function traceDisplacement(au: AudioData, tx: number, depth = 1): number {
  return spikeAmount(au, tx) - duckAmount(au, tx, { depth });
}
