"""Display token -> pronunciation spelling used for CTC alignment.

Each display token (lyric line split on spaces) maps to one or more
pronunciation sub-words made of plain letters (and internal apostrophes).
"""
import re

# Per-token pronunciation overrides, for tokens the generic letter-stripping
# fallback below gets wrong (acronyms, contractions with unusual spelling).
# Empty for this song; add entries here if the CTC alignment QA plots show a
# specific word consistently mis-aligned.
PRON = {}

# Alternative pronunciations to test (scored by alignment likelihood).
ALT = {}


def pron(token: str) -> list[str]:
    if token in PRON:
        return PRON[token].split()
    w = token.lower()
    w = w.replace("’", "'")
    w = re.sub(r"[^a-z' ]", " ", w)
    w = w.strip("' ")
    return [p.strip("'") for p in w.split() if p.strip("'")]


if __name__ == "__main__":
    import common
    for _, _, t in common.load_lyrics_src():
        print(t, "->", " | ".join(" ".join(pron(w)) for w in t.split(" ")))
