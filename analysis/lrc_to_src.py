"""One-off conversion of a line-level .lrc lyric file -> lyrics/lyrics.src.js.

lyrics.src.js holds [start, end, text] triples per line (see common.load_lyrics_src).
An .lrc only timestamps each line's start; end is taken as the next line's start,
capped so a line followed by a long instrumental gap doesn't inherit all of it.

Run:  uv run python lrc_to_src.py <path/to/song.lrc>
"""
import json
import re
import sys
from pathlib import Path

import common

LINE_RE = re.compile(r"\[(\d+):(\d+(?:\.\d+)?)\](.*)")
MAX_TAIL = 3.0  # seconds a line may extend past its own start before the next line


def parse_lrc(path):
    lines = []
    for raw in Path(path).read_text(encoding="utf-8-sig").splitlines():
        m = LINE_RE.match(raw.strip())
        if not m:
            continue
        mm, ss, text = m.groups()
        text = text.strip()
        if not text:
            continue
        t = int(mm) * 60 + float(ss)
        lines.append([t, text])
    lines.sort(key=lambda x: x[0])
    return lines


def main():
    src = Path(sys.argv[1])
    lines = parse_lrc(src)
    out = []
    for i, (t, text) in enumerate(lines):
        nxt = lines[i + 1][0] if i + 1 < len(lines) else t + MAX_TAIL
        end = nxt if nxt - t <= MAX_TAIL else t + MAX_TAIL
        out.append([round(t, 2), round(end, 2), text])
    body = ",\n  ".join(json.dumps(x, ensure_ascii=False) for x in out)
    common.LYRICS_SRC.write_text(f"const LY = [\n  {body}\n];\n", encoding="utf-8")
    print(f"wrote {common.LYRICS_SRC} ({len(out)} lines)")


if __name__ == "__main__":
    main()
