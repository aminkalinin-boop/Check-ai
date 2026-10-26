"""Synthetic, non-user DOCX fixtures; no document uploads or network."""
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile
from tools.highlight_reference_audit import analyze_docx

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

def run(text, color=None):
    prop = f'<w:rPr><w:highlight w:val="{color}"/></w:rPr>' if color else ""
    return f'<w:r>{prop}<w:t>{text}</w:t></w:r>'

def p(*runs):
    return "<w:p>" + "".join(runs) + "</w:p>"

def fixture(xml):
    doc = f'<w:document xmlns:w="{W}"><w:body>{xml}</w:body></w:document>'
    temp = tempfile.TemporaryDirectory()
    path = Path(temp.name) / "sample.docx"
    with ZipFile(path, "w") as z:
        z.writestr("word/document.xml", doc)
    return temp, path

class TestReferenceHighlight(unittest.TestCase):
    def test_mixed_runs_table_and_section(self):
        xml = (p(run("ВВЕДЕНИЕ")) +
               p(run("Обычный научный текст.")) +
               p(run("Выделено ", "magenta"), run("частично.")) +
               '<w:tbl><w:tr><w:tc>' + p(run("Таблица помечена.", "magenta")) +
               '</w:tc></w:tr></w:tbl>' +
               p(run("ГЛАВА 1 ПРИМЕР")) + p(run("Результаты другой главы.")))
        tmp, path = fixture(xml)
        with tmp:
            r = analyze_docx(path)
        self.assertEqual(r["statistics"]["Всего"]["marked_paragraphs"], 2)
        self.assertEqual(r["statistics"]["В таблицах"]["marked_paragraphs"], 1)
        self.assertEqual(r["statistics"]["Вне таблиц"]["marked_paragraphs"], 1)
        self.assertTrue(any(k.startswith("Раздел: ГЛАВА 1") for k in r["statistics"]))
        self.assertNotIn("Выделено ", str(r))
        self.assertIn("NOT verified", r["interpretation"])

    def test_different_highlight_not_counted(self):
        tmp, path = fixture(p(run("Жёлтое выделение.", "yellow")))
        with tmp:
            r = analyze_docx(path)
        self.assertEqual(r["statistics"]["Всего"]["marked_paragraphs"], 0)
        self.assertGreater(r["statistics"]["Всего"]["words"], 0)

if __name__ == "__main__":
    unittest.main()
