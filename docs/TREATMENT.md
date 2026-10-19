# I Only Cry In Sidechain — treatment & style bible

## The idea in one paragraph

The video is presented as **pages from an audio engineer's signal-chain manual** — meters, patch diagrams, transfer-function graphs, a mixing console rendered as architecture — except the signal running through all of it is a human heart, not an audio track. Every plate is a real piece of studio gear or a real engineering diagram (a compressor's threshold graph, a gain-reduction meter, a patch bay, a multitrack mixer, an oscilloscope, an ECG-style trace), and the emotional content of the lyric is staged as what that gear is *doing to the signal*: squashing it flat in verse 1 ("smile compression"), building pressure toward a threshold in the pre-choruses, literally **ducking** the whole frame on every kick drum through the choruses (the sidechain-compression effect, made physical), blowing out into clipping at the bridge ("if I stop ducking, I overflow"), and finally, in the outro, running clean — no compression, no pumping, just the raw signal.

The hero image is drawn directly from the single/cover art: a scrolling, glowing **sidechain-envelope waveform** — a line that spikes on every kick, dips into a ducked trough, and condenses a glossy droplet at the bottom of the dip that drips free. "Crying in sidechain," made completely literal. This waveform-with-droplet is the equivalent of P(doom)'s spark-and-line: the one throughline motif that opens the video, recurs through every chorus, and closes it.

## Tone

- **Not satire.** This is the one deliberate fork away from the project this was built on: P(doom) is deadpan comedy about AI doom; this is a sincere, vulnerable song about emotional suppression. The "treat the abstract thing as a literal diagram" technique is reused, but there is no joke register sitting on top of it — the engineering literalism serves tenderness, not irony.
- Precise, a little cold on the surface (it's gear: meters, graphs, patch cables), warming only when the song does.
- The showpiece gesture is the **duck**: anything — frame, text, a meter needle, a horizon — visibly compresses down and springs back on the kick, exactly the way sidechain-compressed audio pumps. Big changes land on the beat, same discipline as the engine already demands.
- No realistic human face. Reuse the existing blank "assistant smile" mask design (bone disc, two dots, a curve) as the **smile-compression mask** — the flat public face — rather than inventing a new literal face.
- The tear is never drawn on a face. It only ever exists as the abstract liquid-glass droplet hanging off the bottom of a ducked waveform dip — the cover's own device, not an illustrated crying eye.

## Palette

Pulled directly from the single's cover art, not invented:

- **ink** `#000000` background (pure black), **paper** `#F0F1F6` foreground/type.
- **cyan** `#35E6DF` (primary accent) → **sky** `#48B9F1` → **blue** `#5579F5` → **violet** `#884AE8` → **magenta** `#C536E6` (secondary/highlight): one continuous gradient, not five separate hues.
- Color is rationed the way P(doom) rationed bloom: suppressed/defended sections are strictly **black and paper only** — no accent color at all ("no highs, no lows," literally no color). The gradient floods in only at release moments: kicks, the drop, the bridge's overflow, the outro.
- The gradient sweep doubles as a **timeline position**, the same way it reads left-to-right across the cover's waveform: early plates (`console`, `facade`, `threshold1`, `duck1`) lean cyan/sky; the middle (`armor`, `threshold2`, `duck2`) sits in blue/violet; the back half (`overflow`, `pulse`, `duck3`, `unmasked`, `signal`) lands on violet/magenta. The three `duck` choruses escalate in intensity and advance along the gradient at the same time — they're the same move.
- No third accent hue and no warm/cool duality. The gradient already carries the full emotional range; adding another color would dilute the one rule the whole palette runs on.

## Typography

- **Archivo**, weight ~300, wide tracking — the lyric voice, matching the cover's thin geometric caps. Reserve heavier weights (700–900) for the few moments that should feel like a slam rather than a glow: the `duck` hook payoffs.
- **IBM Plex Mono** — meters, dB readouts, compressor settings (`THRESH -18dB`, `RATIO 4:1`, `GR -6.2dB`), the instrument-panel voice.
- **Cormorant Garamond italic** — the **unguarded register**, used only at the bridge ("If I stop ducking, I overflow...") and the outro. Everywhere else the voice is defended (Archivo/Mono); this is the one place it isn't.
- **Single-stroke fonts** (`stroke.ts`) — **handwriting**: a private, written-not-printed register for the moments a real unfiltered thought shows through underneath the performed text (verse 2's memes-as-armor plate especially), instantly covered back up.
- Karaoke/sync rules, title-safe areas, kerning conventions: unchanged from `docs/ENGINE.md` — no reason to touch those.

## Motifs

1. **The trace** — the scrolling sidechain-envelope waveform from the cover: gradient-colored, spikes on the kick, ducks into a trough, condenses a droplet at the bottom that drips free. The hero image; opens, recurs through every chorus, closes the video.
2. **The GR meter** — a gain-reduction needle, the recurring in-world instrument (equivalent of P(doom)'s readout): pinned low in the verses (heavily compressed), climbing in the pre-choruses, slamming on every kick in the choruses, off during the bridge, flatlined-at-zero in the outro.
3. **The duck** — the core recurring gesture: frame/text/meter visibly compresses and springs back on the kick. The hook's literal illustration of "my heart ducks low just like the groove."
4. **The smile-compression mask** — the reused blank assistant mask, standing in for the performed public face.
5. **Clipping/overflow** — distortion, red-free overs (use violet/magenta at full intensity rather than inventing a red), a flat-topped waveform — the vocabulary for "losing control," confined to the bridge and the final chorus.

## Plates (scene modules)

Times are approximate; exact windows come from `src/timeline.ts`, derived from `data/lyrics.json` / `data/audio.json`'s section map (`intro, verse1, prechorus1, chorus1, verse2, prechorus2, chorus2, bridge, breakdown, chorus3, outro_tag, outro`). Look lyric lines up by content through the `Lyrics` API, never hard-code times inside scenes.

| id | window | lyric |
|---|---|---|
| `console` | intro | (instrumental) |
| `facade` | verse1 | I keep it cool... / Feelings muted, nowhere to show |
| `threshold` ×2 | prechorus1, prechorus2 | waits for the drop to come alive / Pressure building in the mix... |
| `duck` ×3 | chorus1, chorus2, chorus3 | I don't break till the kick comes through... / I only cry in sidechain |
| `armor` | verse2 | I talk in jokes, ironic tone / Memes for armor, walls of stone |
| `overflow` | bridge | If I stop ducking, I overflow / If I feel it raw, I lose control |
| `pulse` | breakdown | (instrumental, ~12 bars) |
| `unmasked` | outro_tag | No pump, no shield / Just everything I kept concealed |
| `signal` | outro | (instrumental fade) |

### `console` — intro
A patch bay / mixing desk at rest: monochrome, every meter flat, every fader down. The trace is introduced here, dormant — a single patch cable with no signal in it yet. First hint of cyan appears only as the pickup word is sung, the trace twitching awake.

### `facade` — "Smile compression"
The smile-compression mask sits beside a perfectly flatlined oscilloscope trace. The GR meter is pinned, crushing a signal we never see move. Clinical, quiet, black-and-paper only — the daylight the lyric describes is a flat, even, shadowless studio light, not warmth.

### `threshold` ×2 — "Waits for the drop" / "Pressure building in the mix"
A compressor transfer-function graph (threshold + knee), the GR needle climbing toward it; the whole frame compresses vertically as pressure builds. `threshold1` is one meter, one line, held breath. `threshold2` widens into a multitrack mixer view — many meters climbing at once — and lands the literal pun: a fader cap visibly *slips* on the word "slips."

### `duck` ×3 — the hook, "I only cry in sidechain"
The showpiece. The whole frame ducks on every kick and springs back, exactly tracking the trace's own envelope; the title card's droplet detail recurs here, now attached to the frame's own duck rather than just the waveform. Color (the gradient, at whatever point the timeline has reached) floods in only on the duck's release.
- `duck1` (cyan/sky): clean, controlled duck, brief color flashes.
- `duck2` (blue/violet): harder duck, more color bleeding through, a ratio readout ticking up.
- `duck3` (violet/magenta, final chorus): the duck starts failing to fully recover between hits — color stops fully receding, meters pin into the gradient's hottest end. "Overflow" arriving early.

### `armor` — "Memes for armor"
Ironic captions stack into a typographic wall (Plex Mono), a flat scope trace underneath still compressed — same suppressed state as `facade`, a different defense mechanism. A handwritten (single-stroke) fragment flickers underneath the printed jokes for a frame or two — the real thought, instantly covered back up.

### `overflow` — the bridge
Cormorant italic enters for the first time. A bypass switch flips (compressor OFF, stamped), the trace immediately blows out past 0dBFS into visible clipping — the gradient's full intensity lighting the whole meter bridge at once. The signal breaks out of its own oscilloscope housing into the surrounding dark.

### `pulse` — the breakdown (instrumental, ~12 bars)
The overflowing signal resolves into a slow, continuous ECG-style heartbeat line — "audio signal" recast as literally a pulse. The hypnotic, wordless centerpiece; camera drifts through a space built from the same instrument-panel diagrams, gradient sliding toward violet.

### `unmasked` — "No pump, no shield"
The console imagery falls away. Cormorant italic returns, sustained rather than momentary. The trace runs steady at full dynamic range, in magenta — not pumping anymore, just present. No mask, no meter, no gear.

### `signal` — outro (instrumental fade)
Pull back to reveal the full signal chain traveled through, now quiet and fully lit end to end. Slow fade with the song. Ends on the trace alone, no more drops falling. No joke ending, no loop gag — this song earns a quiet close, not a punchline.

## Technical conventions

See `docs/ENGINE.md`. Deterministic, per-word sync, beat-synced motion, hard cuts on downbeats, performance < 25 ms/frame.
