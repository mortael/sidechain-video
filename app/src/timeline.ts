// The edit: which scene plays when. Boundaries are anchored to lyric lines and snapped
// to the beat grid, so they follow the aligned data (data/lyrics.json, data/audio.json).
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** Cut on the last beat at/before the first word of the matching line (never after the word). */
  const cut = (q: string, nth = 0, tol = 0.02) => {
    const s = ly.get(q, nth).words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + tol)));
  };
  const section = (name: string) => au.sections.find((x) => x.name === name)?.start;

  const b = {
    verse1: cut('I keep it cool'),
    prechorus1: cut('My chest gets quiet'),
    chorus1: cut("I don't break till the kick comes through", 0),
    verse2: cut('I talk in jokes'),
    prechorus2: cut('Pressure building in the mix'),
    chorus2: cut("I don't break till the kick comes through", 1),
    bridge: cut('If I stop ducking'),
    // no lyric anchors the breakdown/outro boundaries: take them from the section
    // map (analyze.py), falling back to the next cut point if sections are missing.
    breakdown: section('breakdown') ?? cut("I don't break till the kick comes through", 2),
    chorus3: cut("I don't break till the kick comes through", 2),
    outroTag: cut('No pump, no shield'),
    outro: section('outro') ?? cut('No pump, no shield') + 10,
    end: au.duration,
  };

  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra });

  return [
    E('console', 'console', 0, b.verse1),
    E('facade', 'facade', b.verse1, b.prechorus1),
    E('threshold1', 'threshold', b.prechorus1, b.chorus1, { params: { n: 1 } }),
    E('duck1', 'duck', b.chorus1, b.verse2, { params: { n: 1 } }),
    E('armor', 'armor', b.verse2, b.prechorus2),
    E('threshold2', 'threshold', b.prechorus2, b.chorus2, { params: { n: 2 } }),
    E('duck2', 'duck', b.chorus2, b.bridge, { params: { n: 2 } }),
    E('overflow', 'overflow', b.bridge, b.breakdown),
    E('pulse', 'pulse', b.breakdown, b.chorus3),
    E('duck3', 'duck', b.chorus3, b.outroTag, { params: { n: 3 } }),
    E('unmasked', 'unmasked', b.outroTag, b.outro),
    E('signal', 'signal', b.outro, b.end),
  ];
}
