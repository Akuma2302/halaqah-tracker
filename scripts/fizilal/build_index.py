"""Build index.json for the in-app Fi Zilal reader from the strips made by
build_pages.py and an OCR pass over them.

The book heads each commentary section "(Pentafsiran ayat 3)" or
"(Pentafsiran ayat-ayat 1 - 5)". OCR is only used to find those headings and
where they sit, so the reader can open at an ayat; the text shown to readers
is always the scanned page itself.

Usage: python build_index.py <out_dir> <ocr.tsv> <ayat_counts.json> [fixes.json]
  ocr.tsv            lines of "<surah>_<strip>\t<y px>\t<text>" (ocr_lines.ps1)
  ayat_counts.json   {"78": 40, ...}
  fixes.json         optional {"79": [[6, 9, 9, 420], ...]} sections to add or
                     replace by hand: [from, to, strip, y]
Writes <out_dir>/index.json and prints anything that needs a human look.
"""
import json
import os
import re
import sys

# OCR confuses digits with look-alike letters, and mangles the heading itself
# ("Pentafsira_n", "P entafsiran", "ayat�ayat", or "(Pentafsiran" left on
# the line above), so match loosely but only on a line that is just a heading.
DIGITS = str.maketrans({"I": "1", "l": "1", "i": "1", "|": "1", "S": "5", "s": "5", "O": "0", "o": "0", "B": "8", "Z": "2"})
NUM = r"([0-9IlisSOoBZ|]{1,3})"
HEADING = re.compile(r"^\(?\s*(?:P\s?.ntafsira_?n\s+)?ayat(?:\Wayat)?\s*" + NUM + r"(?:\s*\W?\s*" + NUM + r")?\s*\)$", re.I)


def main(out_dir, ocr_path, counts_path, fixes_path=None):
    counts = {int(k): v for k, v in json.load(open(counts_path, encoding="utf-8")).items()}
    fixes = json.load(open(fixes_path, encoding="utf-8")) if fixes_path else {}
    found = {}
    for line in open(ocr_path, encoding="utf-8-sig"):
        parts = line.rstrip("\n").split("\t")
        if len(parts) != 3:
            continue
        match = HEADING.match(parts[2].strip())
        if not match:
            continue
        surah, strip = map(int, parts[0].split("_"))
        first = int(match.group(1).translate(DIGITS))
        last = int(match.group(2).translate(DIGITS)) if match.group(2) else first
        found.setdefault(surah, []).append([first, last, strip, int(parts[1])])

    index = {}
    for surah in sorted(counts):
        folder = os.path.join(out_dir, str(surah))
        if not os.path.exists(os.path.join(folder, "strips.json")):
            continue
        strips = json.load(open(os.path.join(folder, "strips.json"), encoding="utf-8"))
        sections = {s[0]: s for s in found.get(surah, [])}
        sections.update({s[0]: s for s in fixes.get(str(surah), [])})
        sections = sorted(sections.values(), key=lambda s: (s[2], s[3]))

        # A misread digit can make a range run into the next section ("1 - S"
        # for "1 - 3"); the next heading's first ayat settles it.
        for cur, nxt in zip(sections, sections[1:]):
            if cur[1] >= nxt[0] > cur[0]:
                cur[1] = nxt[0] - 1

        # Sections should run 1..N in order with no gaps; say so when they don't.
        expected, problems = 1, []
        for first, last, strip, y in sections:
            if first != expected or last < first or last > counts[surah]:
                problems.append(f"{first}-{last} at strip {strip} (expected to start at {expected})")
            expected = last + 1
        if sections and expected != counts[surah] + 1:
            problems.append(f"ends at ayat {expected - 1} of {counts[surah]}")
        if not sections:
            problems.append("no section headings found (opens at the start)")
        if problems:
            print(f"surah {surah}: " + "; ".join(problems))

        index[surah] = {
            "strips": [[s["w"], s["h"]] for s in strips],
            # y as a fraction of the strip's height, so it survives any display size
            "sections": [[f, l, st, round(y / strips[st]["h"], 4)] for f, l, st, y in sections],
        }

    with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, separators=(",", ":"))
    print("surahs", len(index), "sections", sum(len(v["sections"]) for v in index.values()))


if __name__ == "__main__":
    main(*sys.argv[1:5])
