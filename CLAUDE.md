# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A generative, code-rendered music video ("I'm Upping My P(doom)") with word-synced karaoke typography. Every frame is a deterministic function of song time `t`, so the live browser preview and the offline 60 fps export are pixel-identical. The concept/style bible is `docs/TREATMENT.md`; the renderer and scene API are documented in `docs/ENGINE.md`. Read both before writing or editing a scene — they contain the actual authoring rules (determinism, motion blur/sampling constraints, 4K scale handling, typography/kerning conventions) and are more detailed than what's summarized below.

## Layout

- `audio/pdoom.mp3` — the song.
- `lyrics/lyrics.src.js` — original line-level lyrics (approximate timings).
- `analysis/` — Python (uv) tools that produced timing data: Demucs stem separation, CTC forced alignment cross-checked with Whisper, beat/downbeat/onset analysis.
- `data/lyrics.json`, `data/audio.json` — committed, word-level-aligned lyric timings and tempo/beat/section/onset data. This is all the renderer needs; regenerating them requires stems/intermediates not in the repo.
- `app/` — the renderer: TypeScript + three.js, bun + Vite.
  - `app/src/engine/` — renderer core: timeline playback (`scene.ts`, `engine.ts`), audio/lyrics data access (`audio.ts`, `lyrics.ts`), post-processing (`post.ts`), typography (`type.ts`, `stroke.ts`), GPU line batches (`lines.ts`), GL helpers (`gl.ts`), HUD (`hud.ts`), palette (`palette.ts`), scale/4K handling (`scale.ts`), misc math/easing (`util.ts`).
  - `app/src/scenes/` — one module per plate (`open`, `loss`, `prompt`, `hook`, `room`, `shoggoth`, `spacetime`, `ascent`, `bureau`, `leftturn`, `paperclips`, `fuse`, `stack`, `dense`, `loom`, `ilya`, `outro`), plus private per-plate helper files (`<name>-*.ts`) and shared motifs (`_motifs.ts`).
  - `app/src/timeline.ts` — the edit: scene windows anchored to lyric lines, snapped to the beat grid.
  - `app/scripts/render.ts` — offline renderer (headless Chrome → raw frames over WebSocket → ffmpeg).
- `out/` — renders (not in the repo).

## Commands

All renderer work happens in `app/` (bun + Vite; `typescript` is a peer dependency, no separate lint step).

```sh
cd app
bun install
```

**Dev server / live preview** (probably already running — check before starting another):
```sh
bunx vite --port 5173
```
Open `http://localhost:5173/?t=23.0`. Keys: space=play/pause, ←/→=seek ±1s (shift=±5s), `,`/`.`=step one frame, `[`/`]`=prev/next scene, `l`=loop current scene, `h`=hide UI. Add `&scale=2` for a true 4K preview.

**Check a scene you're working on** (don't just eyeball the live preview — render stills and read them with the Read tool):
```sh
bun scripts/render.ts stills --t 12.5,13.0,14.2 --only open --out ../out/wip/open
bun scripts/render.ts sheet --from 1.5 --to 9 --n 16 --cols 4 --only open --out ../out/wip/open/sheet.png
bun scripts/render.ts video --from 20 --to 25 --only hook --out ../out/wip/hook.mp4 --preset veryfast
```
`--only a,b` loads just those timeline entries — faster, and isolates you from other scenes that may currently be broken. Without a matching entry in `src/timeline.ts`, nothing renders (black).

**Typecheck** (no test suite exists):
```sh
bunx tsc --noEmit -p tsconfig.json
```
Scope to your own files while iterating: `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep scenes/yourscene`.

**Full render:**
```sh
bun scripts/render.ts video --samples auto --shutter 0.2 --out ../out/pdoom.mp4
```
4K: add `--scale 2 --x264 aq-mode=3:rc-lookahead=30`. Other modes: `plates` (regenerates `app/public/plates/`, the outro's rewind-montage stills — rerun after changing any scene), `perf` (frame-time profiling). See `README.md` for full flag documentation (`--samples`, `--shutter`, `--chunk`, `--workers`, `--mem-gb`, `--spool-gb`, etc.) and `docs/ENGINE.md` ("Motion blur and sampling") for how adaptive per-tile sampling works.

**Render while editing files:** a live-reloading dev server reloads mid-render and corrupts output. Run one without HMR and point `render.ts` at it:
```sh
PDOOM_NO_HMR=1 bunx vite --port 5190
bun scripts/render.ts ... --url http://localhost:5190
```

**Regenerating timing data** (needs stems/intermediates not in the repo — normally unnecessary):
```sh
cd analysis
uv run python align.py      # -> data/lyrics.json
uv run python analyze.py    # -> data/audio.json
```

## Architecture

**Data flow:** `analysis/` (offline, Python/uv) produces `data/lyrics.json` (word-level lyric timings) and `data/audio.json` (tempo, beats, downbeats, sections, onsets, loudness envelopes) from the song. These committed JSON files are the only input the renderer needs — the app never touches `analysis/` or the raw stems.

**Rendering model:** the `app/` engine is a pure function of song time. `src/timeline.ts` maps time ranges to scene modules + params (one module can serve multiple timeline entries, e.g. `hook` with `{n: 1..4}` or `prompt` with `{variant: ...}`). Each scene is a class extending `Scene` (`src/engine/scene.ts`) that renders HDR linear colour into a target every frame; the frame it receives (`Frame`) carries song time, beat/bar phase, decaying audio-event pulses, and lyric/audio accessors. Determinism is load-bearing: the offline export renders each output frame as the average of many sub-frames spread across a shutter window, rendered out of order and in varying counts per screen tile (adaptive sampling) — any scene that reads wall-clock time, call counts, or unseeded randomness breaks this silently. `docs/ENGINE.md` spells out the exact constraints (`frameIdx(t)` instead of frame counters, seeded noise, `stateful` scenes, tile-masking rules, 4K scale handling).

**Same code, two renderers:** the live Vite preview and `scripts/render.ts`'s offline headless-Chrome export run the identical engine/scene code — there is no separate "export path" to keep in sync.

**Scene isolation:** scene authors should only edit their own `scenes/<name>.ts` (and private `scenes/<name>-*.ts` helpers) — not `src/timeline.ts`, not `src/engine/`, and not `_motifs.ts` (shared motifs used across plates for visual consistency). Report needed engine changes rather than making them directly.

**Style/content authority:** `docs/TREATMENT.md` is the creative spec — palette, typography, per-plate visual treatment, karaoke/lyric-sync rules, what's off-limits (no neon/glow slop, no literal illustration, no reused meme imagery). Changes to a scene's look should stay consistent with it; look up lyric timings through the `Lyrics` API by content (`lyrics.get('some phrase')`), never hard-code times.
