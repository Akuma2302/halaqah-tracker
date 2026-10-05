"""Turn the scanned Fi Zilalil Quran (Malay) surah PDFs into phone-readable
column strips for the in-app tafsir reader.

Each book page is two columns under a running header. A page becomes: the
surah title box (first content page only), then the left column, then the
right column, each trimmed and saved as WebP. Strip sizes go to
<out>/<surah>/strips.json; build_index.py then adds the ayat sections.

Usage: python build_pages.py <pdf_dir> <out_dir> <first_surah> <last_surah>
       (pdf_dir holds <surah>.pdf; requires pymupdf, numpy, pillow)
"""
import json
import os
import sys

import numpy as np
import pymupdf
from PIL import Image

DPI = 200
INK = 140  # grey level below which a pixel counts as ink


def runs(mask, max_gap):
    """(start, end) spans of True values, bridging gaps of up to max_gap False values."""
    idx = np.where(mask)[0]
    if not len(idx):
        return []
    spans, start, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev - 1 > max_gap:
            spans.append((start, prev + 1))
            start = i
        prev = i
    spans.append((start, prev + 1))
    return spans


def trim(ink, x0, y0, x1, y1, pad=6):
    """Shrink a box to its text, dropping scanner bars and specks. None if empty."""
    box = ink[y0:y1, x0:x1]
    # A scanner shadow sits apart from the text block: keep only the widest
    # run of inked columns (text never has a 45px-wide empty vertical band).
    spans = [sp for sp in runs(box.sum(0) >= 2, 45) if sp[1] - sp[0] >= 150]
    if not spans:
        return None
    c0, c1 = max(spans, key=lambda s: box[:, s[0] : s[1]].sum())
    box = box[:, c0:c1]
    rows = np.where(box.sum(1) >= 6)[0]  # specks under a short column don't count
    # Real text has many well-inked rows; a blank column only has specks.
    if not len(rows) or rows[-1] - rows[0] < 60 or (box.sum(1) >= 15).sum() < 20:
        return None
    H, W = ink.shape
    return (
        max(0, x0 + c0 - pad),
        max(0, y0 + rows[0] - pad),
        min(W, x0 + c1 + pad),
        min(H, y0 + rows[-1] + 1 + pad),
    )


def split_page(gray, first_content_page):
    """Boxes (x0, y0, x1, y1) in reading order: [title], left column, right column."""
    H, W = gray.shape
    ink = gray < INK
    # Scanner shadows hug the paper edges; keep them out of every measurement.
    mx, my = int(W * 0.035), int(H * 0.012)
    ink[:, :mx] = ink[:, W - mx :] = False
    ink[:my, :] = ink[H - int(H * 0.02) :, :] = False

    lo, hi = int(W * 0.36), int(W * 0.64)  # odd and even pages sit differently on the scan

    # Title box (first content page): it is closed by a heavy rule across the
    # page, so the body starts under the last near-full-width inked row.
    body_top = title_bottom = my
    if first_content_page:
        span = ink[: int(H * 0.24), int(W * 0.2) : int(W * 0.8)].mean(1)
        rules = np.where(span > 0.5)[0]
        if len(rules):
            title_bottom = int(rules[-1]) + 24  # the corner ornaments hang below the rule
            body_top = title_bottom
    if not first_content_page:
        # Running header (page number, surah, juzuk): the first text-line-high
        # block of inked rows near the top. Measured on the middle of the page,
        # where the surah name sits, to stay clear of scanner bars at the edges.
        rows = ink[: int(H * 0.16), int(W * 0.3) : int(W * 0.7)].sum(1) >= 2
        header = next((b for b in runs(rows, 12) if 12 <= b[1] - b[0] <= 60), None)
        if header:
            body_top = header[1] + 16  # scans tilt a little; clear the whole line

    # Gutter: the widest band near the middle that stays empty down the whole
    # body. Italic passages overhang the column, so it is measured over every
    # row. (Scans are speckled: "empty" allows ink in a handful of rows.)
    density = ink[body_top:, lo:hi].sum(0)
    # The scanner's bar along the bottom edge inks every column equally, so
    # compare with the emptiest column rather than with zero.
    g0, g1 = max(runs(density <= density.min() + 4, 0), key=lambda sp: sp[1] - sp[0])
    gutter = lo + (g0 + g1) // 2
    split_page.last_gutter_width = int(g1 - g0)

    boxes = []
    if title_bottom > my:
        boxes.append(trim(ink, mx, my, W - mx, title_bottom))
    boxes.append(trim(ink, mx, body_top, gutter, H))
    boxes.append(trim(ink, gutter, body_top, W - mx, H))
    return [b for b in boxes if b]


def main(pdf_dir, out_dir, first, last):
    coverage = []  # share of each page's ink that ended up in a strip
    for surah in range(first, last + 1):
        doc = pymupdf.open(os.path.join(pdf_dir, f"{surah}.pdf"))
        folder = os.path.join(out_dir, str(surah))
        os.makedirs(folder, exist_ok=True)
        strips = []
        # Page 1 is an ornamental cover.
        for number in range(1, len(doc)):
            pm = doc[number].get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY)
            gray = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width).copy()
            boxes = split_page(gray, number == 1)
            if split_page.last_gutter_width < 12:
                print(f"  check: surah {surah} page {number + 1} has a {split_page.last_gutter_width}px gutter")
            ink = gray < INK
            kept = sum(int(ink[y0:y1, x0:x1].sum()) for x0, y0, x1, y1 in boxes)
            coverage.append((round(kept / max(1, int(ink.sum())), 3), surah, number + 1))
            for x0, y0, x1, y1 in boxes:
                # The scans are 1-bit, so pure black/white lossless WebP is both
                # exact and several times smaller than a lossy greyscale image.
                image = Image.fromarray(np.where(gray[y0:y1, x0:x1] < INK, 0, 255).astype(np.uint8))
                image.save(os.path.join(folder, f"{len(strips)}.webp"), "WEBP", lossless=True, method=6)
                strips.append({"w": int(x1 - x0), "h": int(y1 - y0), "page": number + 1})
        with open(os.path.join(folder, "strips.json"), "w", encoding="utf-8") as f:
            json.dump(strips, f)
        print(surah, "pages", len(doc), "strips", len(strips))
    # Scanner bars and headers are dropped on purpose, so this is never 100%;
    # a page well below the rest has lost text and needs a look.
    print("lowest ink coverage (share, surah, page):", sorted(coverage)[:12])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
