"""Work out where each surah starts in the "Tafsir Ibnu Katsir" flipbooks
(fliphtml5 bookcase yzewu, 35 parts), so the app can link to the right part
and page. Nothing from the book is kept: each page's running header reads
"90. AL BALAD", and only that surah number is read (by OCR) to build the index.

It samples a header every STEP pages, then bisects between samples to find
the first page of each surah. Page images are cached in <work>/pages.

Usage: python ibnu_katsir_index.py <work_dir> <ocr_lines.ps1> <out.json>
       (Windows: uses the built-in OCR through scripts/fizilal/ocr_lines.ps1)
"""
import concurrent.futures as cf
import json
import os
import re
import subprocess
import sys

from PIL import Image

BASE = "https://online.fliphtml5.com/eqmya"
# (label, flipbook id, pages) in reading order; 8.6 is a separate treatise.
PARTS = [
    ("1a", "sskn", 152), ("1b", "qeig", 150), ("1c", "dbcp", 150), ("1d", "ljnz", 150),
    ("2.1", "galn", 125), ("2.2", "otkh", 126), ("2.3", "ajfk", 124), ("2.4", "ihfg", 123),
    ("3.1", "trix", 134), ("3.2", "kdso", 134), ("3.3", "uepn", 134), ("3.4", "kpva", 131),
    ("4.1", "paww", 150), ("4.2", "idfk", 150), ("4.3", "yasv", 119), ("4.4", "ciuq", 161),
    ("5.1", "lvcr", 162), ("5.2", "uwpx", 159), ("5.3", "aubs", 157), ("5.4", "kvkl", 159),
    ("6.1", "vgcg", 133), ("6.2", "grqt", 132), ("6.3", "jadk", 132), ("6.4", "mtpu", 132), ("6.5", "knbh", 163),
    ("7.1", "lzie", 134), ("7.2", "ebib", 134), ("7.3", "kvtq", 134), ("7.4", "euad", 134), ("7.5", "cwaj", 129),
    ("8.1", "edef", 134), ("8.2", "fqbw", 118), ("8.3", "sesg", 120), ("8.4", "mkrn", 120), ("8.5", "zyow", 112),
]
STEP = 10
DIGITS = str.maketrans({"I": "1", "l": "1", "|": "1", "O": "0", "o": "0", "S": "5", "B": "8", "Z": "2"})


class Headers:
    def __init__(self, work, ocr_script):
        self.work, self.ocr_script = work, ocr_script
        self.cache_path = os.path.join(work, "headers.json")
        self.known = json.load(open(self.cache_path)) if os.path.exists(self.cache_path) else {}
        os.makedirs(os.path.join(work, "pages"), exist_ok=True)
        os.makedirs(os.path.join(work, "hdr"), exist_ok=True)

    def _fetch(self, item):
        part, page = item
        book = PARTS[part][1]
        raw = os.path.join(self.work, "pages", f"{part}_{page}.webp")
        if not os.path.exists(raw) or os.path.getsize(raw) < 5000:
            subprocess.run(["curl", "-s", "-m", "60", "-A", "Mozilla/5.0", "-e", f"{BASE}/{book}/", "-o", raw,
                            f"{BASE}/{book}/files/large/{page}.webp"])
        out = os.path.abspath(os.path.join(self.work, "hdr", f"{part}_{page}.png"))
        try:
            im = Image.open(raw).convert("L")
            im.crop((0, 0, im.width, int(im.height * 0.14))).save(out)
            return out
        except Exception:
            return None

    def read(self, items):
        """Surah number in the header of each (part index, page); None if there isn't one."""
        todo = [i for i in items if f"{i[0]}_{i[1]}" not in self.known]
        if todo:
            with cf.ThreadPoolExecutor(4) as ex:
                files = [f for f in ex.map(self._fetch, todo) if f]
            lst, tsv = os.path.join(self.work, "list.txt"), os.path.join(self.work, "ocr.tsv")
            open(lst, "w").write("\n".join(files))
            subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", self.ocr_script, lst, tsv])
            found = {}
            for line in open(tsv, encoding="utf-8-sig"):
                name, _, text = (line.rstrip("\n").split("\t") + ["", ""])[:3]
                m = re.match(r"\s*([0-9IlOoSBZ|]{1,3})\s*(?:[-–]\s*[0-9IlOoSBZ|]{1,3}\s*)?[.,]\s*['`‘’]?\s*[A-Z]", text)  # 80. 'ABASA has a leading quote
                if m and name not in found:
                    n = int(m.group(1).translate(DIGITS))
                    if 1 <= n <= 114:
                        found[name] = n
            for i in todo:
                key = f"{i[0]}_{i[1]}"
                self.known[key] = found.get(key)
            json.dump(self.known, open(self.cache_path, "w"))
        return [self.known[f"{i[0]}_{i[1]}"] for i in items]


def main(work, ocr_script, out_path):
    headers = Headers(work, ocr_script)
    # One long run of pages across all parts.
    pages = [(p, n) for p, (_, _, count) in enumerate(PARTS) for n in range(1, count + 1)]
    sample = [i for i, (p, n) in enumerate(pages) if n % STEP == 2 or n == PARTS[p][2]]
    headers.read([pages[i] for i in sample])

    def value(i):
        return headers.known.get(f"{pages[i][0]}_{pages[i][1]}")

    # Bisect between neighbouring samples whose surah differs, until every
    # surah's first page is pinned down. A page without a header (a surah's
    # opening page, say) can't steer the bisection, so once a gap is small
    # every page in it is read.
    while True:
        seen = [i for i in range(len(pages)) if value(i) is not None]
        need = []
        for a, b in zip(seen, seen[1:]):
            if value(a) == value(b) or b - a <= 1:
                continue
            unread = [i for i in range(a + 1, b) if f"{pages[i][0]}_{pages[i][1]}" not in headers.known]
            middle = (a + b) // 2
            # Bisect while the middle page is still unread; after that (small
            # gap, or the middle turned out to have no header) read the rest.
            need += [middle] if b - a > 12 and middle in unread else unread
        if not need:
            break
        headers.read([pages[i] for i in need])

    # Surah numbers only ever go up, a few at a time; anything else is an OCR
    # misread of the header and is ignored.
    starts, current = {}, 0
    for i in range(len(pages)):
        v = value(i)
        if v is None or not (current <= v <= current + 3):
            continue
        if v not in starts:
            # A surah opens on a page without the running header, so it begins
            # on the header-less page just before its first headed page.
            first = i
            if i > 0 and pages[i - 1][0] == pages[i][0] and f"{pages[i - 1][0]}_{pages[i - 1][1]}" in headers.known and value(i - 1) is None:
                first = i - 1
            starts[v] = {"part": PARTS[pages[first][0]][0], "book": PARTS[pages[first][0]][1], "page": pages[first][1]}
        current = v
    # The book treats 113 and 114 (al-Mu'awwidzatain) as one chapter.
    if 113 in starts and 114 not in starts:
        starts[114] = starts[113]
    json.dump(starts, open(out_path, "w"), indent=1)
    missing = [s for s in range(1, 115) if s not in starts]
    print("surahs found", len(starts), "missing", missing, "headers read", len(headers.known))


if __name__ == "__main__":
    main(*sys.argv[1:4])
