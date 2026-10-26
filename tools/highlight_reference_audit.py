#!/usr/bin/env python3
"""Summarize reference highlights in a DOCX, entirely locally.

Vendor highlights are annotations, not ground truth of authorship.
No document text, names or paragraphs are written into the JSON output.
No network usage, no third-party packages, no writes unless --json-out is set.

python3 tools/highlight_reference_audit.py "file.docx" --color magenta
"""
import argparse
import json
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
WORD = re.compile(r"[А-Яа-яЁёA-Za-z]+")
HEADING = re.compile(r"^(?:ВВЕДЕНИЕ|ЗАКЛЮЧЕНИЕ|СПИСОК\s+ЛИТЕРАТУРЫ|ГЛАВА\s+[1-9]\d*.+)$", re.I)

def read_para(p, color):
    parts, n, marked = [], 0, 0
    for run in p.iter(W + "r"):
        text = "".join(x.text or "" for x in run.iter(W + "t"))
        if not text:
            continue
        parts.append(text)
        n += len(text)
        prop = run.find(W + "rPr")
        h = prop.find(W + "highlight") if prop is not None else None
        if h is not None and h.attrib.get(W + "val", "").lower() == color.lower():
            marked += len(text)
    text = "".join(parts)
    title = text.strip()
    return {
        "words": len(WORD.findall(text)),
        "chars": n,
        "highlighted_chars": marked,
        "ratio": marked / n if n else 0,
        "section": title if HEADING.fullmatch(title) and "…" not in title and len(title) <= 220 else None
    }

def analyze_docx(path, color="magenta"):
    with zipfile.ZipFile(path) as z:
        try:
            xml = z.read("word/document.xml")
        except KeyError as exc:
            raise ValueError("Not a DOCX file with Word document XML") from exc
    root = ET.fromstring(xml)
    body = root.find(W + "body")
    if body is None:
        raise ValueError("Word body missing")
    sections = defaultdict(lambda: {
        "paragraphs": 0, "words": 0, "marked_paragraphs": 0,
        "almost_entirely_marked_paragraphs": 0, "characters": 0,
        "highlighted_characters": 0
    })
    current = "До основного текста"
    for item in body:
        if item.tag == W + "p":
            paragraphs = [(item, False)]
        elif item.tag == W + "tbl":
            paragraphs = [(p, True) for p in item.iter(W + "p")]
        else:
            continue
        for p, table in paragraphs:
            data = read_para(p, color)
            if not table and data["section"]:
                current = data["section"]
            if not data["words"]:
                continue
            for category in ("Всего", "В таблицах" if table else "Вне таблиц", "Раздел: " + current):
                v = sections[category]
                v["paragraphs"] += 1
                v["words"] += data["words"]
                v["characters"] += data["chars"]
                v["highlighted_characters"] += data["highlighted_chars"]
                v["marked_paragraphs"] += int(data["highlighted_chars"] > 0)
                v["almost_entirely_marked_paragraphs"] += int(data["ratio"] >= 0.75)
    for v in sections.values():
        v["highlighted_char_percent"] = round(
            100 * v["highlighted_characters"] / max(v["characters"], 1), 2)
    return {
        "reference_color": color,
        "interpretation": "Reference highlight is NOT verified AI authorship",
        "denominator": "local count of Word text characters, different from vendor detector",
        "statistics": dict(sections)
    }

def main():
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument("docx")
    a.add_argument("--color", default="magenta")
    a.add_argument("--json-out", type=Path, help="Optional aggregate-only JSON")
    opt = a.parse_args()
    try:
        result = analyze_docx(opt.docx, opt.color)
    except (OSError, zipfile.BadZipFile, ET.ParseError, ValueError) as exc:
        print("Read error:", exc, file=sys.stderr)
        return 2
    print(result["interpretation"])
    for label, v in result["statistics"].items():
        print(f"{label}: {v['words']} words; "
              f"{v['marked_paragraphs']}/{v['paragraphs']} marked paragraphs; "
              f"{v['highlighted_char_percent']}% highlighted characters")
    if opt.json_out:
        opt.json_out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0

if __name__ == "__main__":
    sys.exit(main())
