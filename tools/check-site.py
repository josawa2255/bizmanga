#!/usr/bin/env python3
"""Offline syntax, JSON-LD, local script/stylesheet and load-order checks."""

import ast
import importlib.util
import json
import shutil
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEPENDENCIES = {
    "bm-contact.js": ["bm-lead.js"],
    "bm-download.js": ["bm-lead.js"],
    "bm-testimonial-detail.js": ["bm-sanitize.js"],
    "bm-column-detail.js": ["bm-sanitize.js", "bm-pricing.js"],
    "bm-news-detail.js": ["bm-sanitize.js"],
    "bm-wp-api.js": ["bm-wp-config.js"],
    "artists.js": ["artists-data.js"],
    # Manga view type is resolved in one place (SPEC §3); the split-pane helper must exist
    # before the modals that call it (SPEC §8.1).
    "bm-hero.js": ["bm-view-type.js", "bm-wd-split.js"],
    "bm-works-page.js": ["bm-view-type.js", "bm-wd-split.js"],
    "bm-work-modal.js": ["bm-view-type.js"],
    "works.js": ["bm-view-type.js"],
    "bm-embed-viewer.js": ["bm-view-type.js"],
    "bm-scroll-anim.js": ["bm-cta.js"],
}
# The work-detail modal markup is duplicated in these pages; its JS relies on the same ids.
WORK_MODAL_PAGES = ["index.html", "works.html", "tools/templates/works-category.html.tpl"]
VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "source",
    "track",
    "wbr",
}


class SubtreeIds(HTMLParser):
    """Collect element ids inside the element whose id is root_id."""

    def __init__(self, root_id):
        super().__init__(convert_charrefs=False)
        self.root_id, self.depth, self.ids = root_id, 0, []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.depth:
            if attrs.get("id"):
                self.ids.append(attrs["id"])
            if tag not in VOID_TAGS:
                self.depth += 1
        elif attrs.get("id") == self.root_id:
            self.ids.append(self.root_id)
            self.depth = 1

    def handle_endtag(self, tag):
        if self.depth and tag not in VOID_TAGS:
            self.depth -= 1


def check_work_modal_markup():
    shapes = {}
    for name in WORK_MODAL_PAGES:
        parser = SubtreeIds("workDetailOverlay")
        parser.feed((ROOT / name).read_text(encoding="utf-8"))
        shapes[name] = parser.ids
    if not all(shapes.values()) or len({tuple(ids) for ids in shapes.values()}) != 1:
        raise ValueError(f"Work modal markup differs between pages: {shapes}")


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=False)
        self.path = path
        self.scripts = []
        self.styles = []
        self.inline = []
        self.active = None
        self.parts = []

    def local(self, url):
        url = urlsplit(url)
        if url.scheme or url.netloc:
            return
        value = unquote(url.path)
        target = (
            ROOT / value.lstrip("/") if value.startswith("/") else self.path.parent / value
        ).resolve()
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
            name = Path(urlsplit(attrs["href"]).path).name
            if name in ("bm-column-static.css", "bm-column-detail.css"):
                if "bm-column-body.css" not in self.styles:
                    raise ValueError(f"{self.path.name}: bm-column-body.css must precede {name}")
            self.styles.append(name)

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
        elif (
            self.active in ("text/javascript", "application/javascript", "module") and code.strip()
        ):
            self.inline.append((code, self.active))
        self.active = None


def node_executable():
    executable = shutil.which("node")
    if executable:
        return executable
    spec = importlib.util.find_spec("playwright")
    if spec and spec.origin:
        bundled = (
            Path(spec.origin).parent
            / "driver"
            / ("node.exe" if __import__("os").name == "nt" else "node")
        )
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
    pages = [
        *ROOT.glob("*.html"),
        *ROOT.glob("column/*.html"),
        *ROOT.glob("works/**/*.html"),
        *ROOT.glob("tools/templates/*.html.tpl"),
    ]
    # Identical inline analytics snippets need only one syntax check.
    inline = set()
    for path in pages:
        page = Page(path)
        try:
            page.feed(path.read_text(encoding="utf-8"))
            if "bm-nav.js" in page.scripts and page.scripts.count("bm-conversions.js") != 1:
                raise ValueError("Navigation pages must load bm-conversions.js exactly once")
        except Exception as error:
            raise ValueError(f"{path.relative_to(ROOT)}: {error}") from error
        inline.update(page.inline)
    check_work_modal_markup()
    with tempfile.TemporaryDirectory(prefix="bm-js-check-") as folder:
        for index, (code, kind) in enumerate(sorted(inline)):
            path = Path(folder) / f"inline-{index}.{'mjs' if kind == 'module' else 'js'}"
            path.write_text(code, encoding="utf-8")
            subprocess.run([node, "--check", str(path)], check=True)
    print(
        f"PASS: {len(python_files)} Python files, {len(scripts)} JS files, "
        f"{len(pages)} HTML/templates, {len(inline)} unique inline scripts"
    )


if __name__ == "__main__":
    main()
