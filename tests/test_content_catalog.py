"""Run with: python -m unittest discover -s tests"""

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

from mkdocs.config import load_config
from mkdocs.structure.files import get_files
from mkdocs.utils.meta import get_data


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("content_catalog", ROOT / "hooks/content_catalog.py")
catalog = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(catalog)


class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = load_config(str(ROOT / "mkdocs.yml"))
        cls.files = get_files(cls.config)
        # Discover the source collection independently of the hook, so adding
        # another article automatically expands the expected catalog.
        cls.article_files = [
            file for file in cls.files
            if file.src_uri == "movie.md"
            or (file.src_uri.endswith(".md") and file.src_uri.startswith(("math/reflections/", "writing/")))
        ]
        cls.expected_total = len(cls.article_files) + len(catalog.PDF_NOTES)
        cls.expected_math = sum(file.src_uri.startswith("math/") for file in cls.article_files) + len(catalog.PDF_NOTES)
        cls.entries = catalog.build_catalog(cls.files)

    def test_counts_and_unique_ids(self):
        self.assertEqual(len(self.entries), self.expected_total)
        self.assertEqual(sum(item["format"] == "pdf" for item in self.entries), len(catalog.PDF_NOTES))
        self.assertEqual(sum(item["scope"] == "math" for item in self.entries), self.expected_math)
        self.assertEqual(len({item["id"] for item in self.entries}), self.expected_total)
        expected_ids = {get_data(file.content_string)[1]["comment_id"] for file in self.article_files}
        expected_ids.update(note["id"] for note in catalog.PDF_NOTES)
        self.assertEqual({item["id"] for item in self.entries}, expected_ids)
        expected_urls = {file.url for file in self.article_files}
        expected_urls.update(self.files.get_file_from_path(note["path"]).url for note in catalog.PDF_NOTES)
        self.assertEqual({item["url"] for item in self.entries}, expected_urls)

    def test_static_fallback_and_scopes(self):
        rendered = catalog.render_catalog(self.entries, "math", "math/")
        self.assertEqual(rendered.count("data-entry "), self.expected_math)
        self.assertIn('href="../Geometry/midterm.pdf"', rendered)
        self.assertIn('data-library-controls hidden', rendered)
        self.assertNotIn('data-library-scope="writing"', rendered)
        self.assertNotIn('<script', rendered)

    def test_relative_links(self):
        entry = next(item for item in self.entries if item["id"] == "essay-2026-05-19-running-dry")
        self.assertIn('href="writing/essays/running-dry/"', catalog.render_entry(entry, ""))
        self.assertIn('href="../../../writing/essays/running-dry/"', catalog.render_entry(entry, "math/reflections/example/"))

    def test_html_and_attributes_are_escaped(self):
        entry = {**self.entries[0], "title": '<img src=x onerror="boom">',
                 "summary": '<script>alert("x")</script>', "topics": ['"quoted" <tag>']}
        rendered = catalog.render_entry(entry, "")
        self.assertNotIn('<img', rendered)
        self.assertNotIn('<script', rendered)
        self.assertIn('&lt;img', rendered)
        self.assertIn('&quot;', rendered)

    def test_unknown_dates_not_invented(self):
        for stable_id in ("pdf-harmonic-polynomials", "pdf-bochner-technique"):
            entry = next(item for item in self.entries if item["id"] == stable_id)
            self.assertEqual(entry["year"], "")
            self.assertEqual(entry["date_label"], "")

    def test_content_metadata_only(self):
        rendered = catalog.render_catalog(self.entries, "all", "explore/")
        self.assertNotIn('href="../about/"', rendered)
        self.assertNotIn('href="../cv/', rendered)
        self.assertNotIn('href="../resume/', rendered)
        entry = {
            **self.entries[0],
            "author": "private_field_sentinel",
            "institution": "private_field_sentinel",
            "private": {"resume_url": "private_field_sentinel"},
        }
        self.assertNotIn("private_field_sentinel", catalog.render_entry(entry, ""))

    def test_marker_replacement(self):
        catalog._catalog = self.entries
        output = catalog.on_page_markdown(
            '# 浏览\n\n<!-- hm:catalog scope=all -->',
            page=SimpleNamespace(url="explore/"), config=self.config, files=None,
        )
        self.assertNotIn("hm:catalog", output)
        self.assertEqual(output.count("data-entry "), self.expected_total)


if __name__ == "__main__":
    unittest.main()
