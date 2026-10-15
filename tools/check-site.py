#!/usr/bin/env python3
"""Offline syntax, JSON-LD, local script/stylesheet and load-order checks."""
import ast
from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEPENDENCIES = {
    "bm-contact.js": ["bm-lead.js"], "bm-download.js": ["bm-lead.js"],
    "bm-testimonial-detail.js": ["bm-sanitize.js"],
    "bm-column-detail.js": ["bm-sanitize.js", "bm-pricing.js"],
    "bm-news-detail.js": ["bm-sanitize.js"],
}


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=False)
        self.path = path
        self.scripts = []
        self.inline = []
        self.active = None
        self.parts = []

    def local(self, url):
        url = urlsplit(url)
        if url.scheme or url.netloc:
            return
        value = unquote(url.path)
        target = (ROOT / value.lstrip("/") if value.startswith("/") else self.path.parent / value).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            raise ValueError(f"{self.path.relative_to(ROOT)}: missing local asset {value}")

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script":
            if attrs.get("src"):
                self.local(attrs["src"])
                name = Path(urlsplit(attrs["src"]).path).name
                for required in DEPENDENCIES.get(name, []):
                    if required not in self.scripts:
                        raise ValueError(f"{self.path.name}: {required} must precede {name}")
                self.scripts.append(name)
            else:
                self.active = attrs.get("type", "text/javascript")
                self.parts = []
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.local(attrs.get("href", ""))

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag != "script" or not self.active:
            return
        code = "".join(self.parts)
        if self.active in ("application/json", "application/ld+json"):
            if not self.path.name.endswith(".tpl"):
                json.loads(code)
        elif self.active in ("text/javascript", "application/javascript", "module") and code.strip():
            self.inline.append((code, self.active))
        self.active = None


def check_column_page():
    """column.html: 一覧・特集枠は静的ビルド（tools/build-columns.py）の HTML が正。WP から作り直す
    bm-wp-api.js を読まず、特集枠と、同じ記事の一覧の先頭カード（スマホ用）がビルダーの出力で入っていること。"""
    source = (ROOT / "column.html").read_text(encoding="utf-8")
    scripts = [Path(urlsplit(src).path).name for src in re.findall(r"<script\b[^>]*\bsrc=\"([^\"]+)\"", source)]
    for name in ("bm-wp-api.js", "bm-wp-config.js"):
        if name in scripts:
            raise ValueError(f"column.html must not load {name}: it rebuilds the static list (Issue #74)")

    def block(name):
        start, end = f"<!-- BUILD:{name} -->", f"<!-- /BUILD:{name} -->"
        if source.count(start) != 1 or source.count(end) != 1:
            raise ValueError(f"column.html: expected one {start} ... {end}")
        return source.split(start, 1)[1].split(end, 1)[0]

    section = re.search(r"<section\b[^>]*\bid=\"bmColumnFeatured\"[^>]*>", source)
    if not section or re.search(r"\b(?:style|hidden)\b", section[0]):
        raise ValueError("column.html: #bmColumnFeatured must be shown without JavaScript")
    featured = re.findall(r'<a class="bm-column-featured-card"[^>]*\bhref="(/column/[^"]+)"[^>]*\bdata-category="[^"]+"',
                          block("COLUMN_FEATURED"))
    cards = re.findall(r'<a class="(bm-column-card[^"]*)" href="([^"]+)"( data-category="[^"]+")?', block("COLUMN_GRID"))
    if len(featured) != 1 or not cards:
        raise ValueError("column.html: the builder must write one featured article and the cards")
    marked = [href for cls, href, _ in cards if "bm-column-card--featured" in cls.split()]
    if marked != [featured[0]] or cards[0][1] != featured[0]:
        raise ValueError("column.html: the first card must be the featured article (shown on phones)")
    if any(not href.startswith("/column/") or not category for _, href, category in cards):
        raise ValueError("column.html: every card needs a /column/ link and data-category")
    return len(cards)


def node_executable():
    executable = shutil.which("node")
    if executable:
        return executable
    spec = importlib.util.find_spec("playwright")
    if spec and spec.origin:
        bundled = Path(spec.origin).parent / "driver" / ("node.exe" if __import__("os").name == "nt" else "node")
        if bundled.is_file():
            return str(bundled)
    raise RuntimeError("Install Node.js to validate JavaScript")


def main():
    node = node_executable()
    python_files = [*ROOT.glob("*.py"), *ROOT.glob("tools/*.py")]
    for path in python_files:
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    scripts = [*ROOT.glob("js/**/*.js"), ROOT / "sw.js"]
    for path in scripts:
        subprocess.run([node, "--check", str(path)], check=True)
    pages = [*ROOT.glob("*.html"), *ROOT.glob("column/*.html"), *ROOT.glob("works/**/*.html"),
             *ROOT.glob("tools/templates/*.html.tpl")]
    # Identical inline analytics snippets need only one syntax check.
    inline = set()
    for path in pages:
        page = Page(path)
        try:
            page.feed(path.read_text(encoding="utf-8"))
        except Exception as error:
            raise ValueError(f"{path.relative_to(ROOT)}: {error}") from error
        inline.update(page.inline)
    column_cards = check_column_page()
    with tempfile.TemporaryDirectory(prefix="bm-js-check-") as folder:
        for index, (code, kind) in enumerate(sorted(inline)):
            path = Path(folder) / f"inline-{index}.{'mjs' if kind == 'module' else 'js'}"
            path.write_text(code, encoding="utf-8")
            subprocess.run([node, "--check", str(path)], check=True)
    print(f"PASS: {len(python_files)} Python files, {len(scripts)} JS files, "
          f"{len(pages)} HTML/templates, {len(inline)} unique inline scripts, "
          f"column.html static featured + {column_cards} cards")


if __name__ == "__main__":
    main()
