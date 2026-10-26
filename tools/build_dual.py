"""Make two builds from the UNMODIFIED Check-AI source files.

Usage: python3 tools/build_dual.py
  dist/offline/index.html  — standalone HTML with no external font requests
  dist/online/index.html   — original UI and analyzer plus optional AI review pane
The canonical index.html is not written or modified.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src"
ORDER = [
    "analyzer.js", "content.js", "stylometry.js", "extra.js",
    "robustness.js", "report_docx.js", "report2.js", "annotate.js", "platform.js", "ui.js"
]


def build_core():
    template = (SOURCE / "template.html").read_text(encoding="utf-8")
    jszip = (ROOT / "vendor" / "jszip.min.js").read_text(encoding="utf-8")
    js = "\n".join((SOURCE / name).read_text(encoding="utf-8") for name in ORDER)
    if "</script" in jszip.lower() or "</script" in js.lower():
        raise ValueError("Unsafe closing script tag in source")
    if template.count("/*JSZIP*/") != 1 or template.count("/*APP*/") != 1:
        raise ValueError("Expected one copy of each original build placeholder")
    return template.replace("/*JSZIP*/", jszip).replace("/*APP*/", js)


def main():
    core = build_core()
    out_offline = ROOT / "dist" / "offline"
    out_online = ROOT / "dist" / "online"
    out_offline.mkdir(parents=True, exist_ok=True)
    out_online.mkdir(parents=True, exist_ok=True)

    # The core already includes JSZip and all business logic. Strip optional
    # external web-font stylesheets to avoid even a font request when offline.
    offline = re.sub(r'<link\s+rel="preconnect"\s+href="https://fonts\.googleapis\.com"\s*>\s*', "", core)
    offline = re.sub(r'<link\s+rel="stylesheet"\s+href="https://fonts\.googleapis\.com/[^"]+"\s*>\s*', "", offline)
    if "fonts.googleapis.com" in offline:
        raise ValueError("Offline build retains an external font request")

    # The online build is identical to root index.html: shared app code plus
    # optional add-on injected into the same script by the original build flow.
    template = (SOURCE / "template.html").read_text(encoding="utf-8")
    jszip = (ROOT / "vendor" / "jszip.min.js").read_text(encoding="utf-8")
    addon = (ROOT / "online" / "online_addon.js").read_text(encoding="utf-8")
    js = "\n".join((SOURCE / name).read_text(encoding="utf-8") for name in ORDER) + "\n" + addon
    if "</script" in addon.lower():
        raise ValueError("Unsafe closing script tag in online add-on")
    online = template.replace("/*JSZIP*/", jszip).replace("/*APP*/", js)

    (out_offline / "index.html").write_text(offline, encoding="utf-8")
    (out_online / "index.html").write_text(online, encoding="utf-8")
    print("Both Check-AI versions built from one unchanged core:")
    print("  dist/offline/index.html")
    print("  dist/online/index.html")


if __name__ == "__main__":
    main()
