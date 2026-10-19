"""Run faster-whisper (word timestamps) on the time-corrected vocal stem.

Writes work/whisper_<tag>.json, in the same {"segments": [{"words": [...]}]}
shape align.py's whisper_words() expects. Used as an independent cross-check
for the CTC forced alignment in align.py.
"""
import common  # noqa: F401  (sets cache dirs)
import json
import sys

import numpy as np
from faster_whisper import WhisperModel

MODELS = {
    "turbo": "deepdml/faster-whisper-large-v3-turbo-ct2",
    "large": "large-v3",
}


def vocals16k():
    """16 kHz mono vocal stem for whisper (cached under work/ as float32)."""
    p = common.WORK / "vocals16k.npy"
    if not p.exists():
        y, _ = common.load_stem("vocals", sr=16000)
        np.save(p, y.astype(np.float32))
    return np.load(p)


def run(tag, model_name, prompt=None):
    # ctranslate2's CUDA wheel wants CUDA 12's cublas64_12.dll, which isn't on
    # PATH alongside the project's CUDA-13 torch; CPU is plenty fast for one
    # cross-check pass over a ~4 min song.
    device = "cpu"
    compute_type = "int8"
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    # Pass audio as an array rather than a path: the installed PyAV version
    # dropped the kwarg faster-whisper's own file decoder calls internally.
    segments, _ = model.transcribe(
        vocals16k(), language="en", word_timestamps=True,
        condition_on_previous_text=False, initial_prompt=prompt, temperature=0.0,
        vad_filter=False,
    )
    out_segments = []
    for seg in segments:
        words = [{"word": w.word, "start": w.start, "end": w.end} for w in (seg.words or [])]
        out_segments.append({"start": seg.start, "end": seg.end, "text": seg.text, "words": words})
        print(f"{seg.start:7.2f} {seg.end:7.2f} {seg.text}")
    out = {"segments": out_segments}
    (common.WORK / f"whisper_{tag}.json").write_text(json.dumps(out, indent=1, default=float), encoding="utf-8")
    return out


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "turbo"
    lyr = " ".join(t for _, _, t in common.load_lyrics_src())
    prompt = f"Song lyrics: {lyr}"
    run(which, MODELS[which])
    run(which + "_prompt", MODELS[which], prompt)
