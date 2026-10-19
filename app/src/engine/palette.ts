import { hexToLinear, lerp, clamp } from './util';

// The whole video lives in a restrained palette: ink, bone, and one signal colour.
// One rare accent (acid, the shrooms moment) — see docs/TREATMENT.md.
export const HEX = {
  ink: '#0A0A0B', // background black (slightly warm)
  ink2: '#151517', // raised black (panels, paper-in-the-dark)
  graphite: '#5E5B57', // dim lines, secondary text
  ash: '#9C978F', // mid grey
  bone: '#EEE9DF', // paper white, primary text
  signal: '#FF4D12', // hazard orange: the spark, the fuse, P(doom)
  ember: '#FF8A3D', // hotter, lighter orange for cores/highlights
  blood: '#C21D0B', // deep red-orange for shadows of signal
  acid: '#D8FF3C', // acid: only for the shrooms moment

  // --- "I Only Cry In Sidechain" palette (from the single's cover art; see docs/TREATMENT.md) ---
  black: '#000000', // background (pure black, not ink's warm near-black)
  panel: '#0C0D10', // raised black: meter housings, panels
  paper: '#F0F1F6', // foreground/type
  mist: '#5A5F6B', // dim neutral grey: unsung text, hairlines (never a hue — suppressed state stays colourless)
  cyan: '#35E6DF', // gradient stop 0 (primary accent)
  sky: '#48B9F1', // gradient stop 1
  blue: '#5579F5', // gradient stop 2
  violet: '#884AE8', // gradient stop 3
  magenta: '#C536E6', // gradient stop 4 (secondary/highlight)
} as const;

export type PaletteKey = keyof typeof HEX;

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The sidechain gradient's stops, cyan -> magenta. */
const GRADIENT_STOPS: PaletteKey[] = ['cyan', 'sky', 'blue', 'violet', 'magenta'];

/** Linear RGB at position k (0 = cyan, 1 = magenta) along the gradient. */
export function gradientLin(k: number): [number, number, number] {
  const n = GRADIENT_STOPS.length;
  const x = clamp(k) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const f = x - i;
  const a = LIN[GRADIENT_STOPS[i]!]!, b = LIN[GRADIENT_STOPS[i + 1]!]!;
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

/** CSS rgba() at position k (0 = cyan, 1 = magenta) along the gradient. */
export function gradientRgba(k: number, a = 1): string {
  const n = GRADIENT_STOPS.length;
  const x = clamp(k) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const key0 = (HEX as Record<string, string>)[GRADIENT_STOPS[i]!]!, key1 = (HEX as Record<string, string>)[GRADIENT_STOPS[i + 1]!]!;
  const f = x - i;
  const p0 = parseInt(key0.replace('#', ''), 16), p1 = parseInt(key1.replace('#', ''), 16);
  const ch = (n0: number, n1: number, shift: number) => Math.round(lerp((n0 >> shift) & 255, (n1 >> shift) & 255, f));
  return `rgba(${ch(p0, p1, 16)},${ch(p0, p1, 8)},${ch(p0, p1, 0)},${a})`;
}
