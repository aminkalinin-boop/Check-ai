"""Сборка index.html из исходников: python3 build.py"""
from pathlib import Path
root = Path(__file__).parent
t = (root / 'src/template.html').read_text(encoding='utf8')
jz = (root / 'vendor/jszip.min.js').read_text(encoding='utf8')
order = ['analyzer.js', 'content.js', 'stylometry.js', 'extra.js', 'robustness.js', 'academic_audit.js', 'discourse_audit.js', 'provenance_fairness.js', 'offline_engine.js', 'short_text_audit.js', 'annotation_guidance.js', 'reference_highlights.js', 'linguistic_diagnostics.js', 'report_docx.js', 'report2.js', 'annotate.js', 'platform.js', 'ui.js']
app = '\n'.join((root / 'src' / f).read_text(encoding='utf8') for f in order)
app += '\n' + (root / 'online' / 'site_config.js').read_text(encoding='utf8')
app += '\n' + (root / 'online' / 'online_addon.js').read_text(encoding='utf8')
assert '</script' not in jz.lower() and '</script' not in app.lower()
(root / 'index.html').write_text(t.replace('/*JSZIP*/', jz).replace('/*APP*/', app), encoding='utf8')
print('index.html собран')
