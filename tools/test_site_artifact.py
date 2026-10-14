"""公開ファイルの絞り込み（tools/build-site-artifact.py）の検査。デプロイ前に実行する（.github/workflows/pages.yml）。
- 内部資料（md・docs・スクリプト・テスト・順位の履歴）が公開対象に入っていない
- 公開する HTML / CSS が参照するサイト内ファイルが、公開対象から漏れていない
python3 -m unittest discover -s tools -p test_site_artifact.py"""
import importlib.util
import posixpath
import re
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_site_artifact", ROOT / "tools" / "build-site-artifact.py")
bsa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bsa)

CANDIDATES = bsa.tracked_files()
CANDIDATE_SET = set(CANDIDATES)
PUBLIC = {f for f in CANDIDATES if bsa.is_public(f)}
REF = re.compile(r'''(?:src|href|poster|content)\s*=\s*["']([^"'#?]+)|url\(\s*["']?([^"')#?]+)''', re.I)
MUST_HIDE = ("CLAUDE.md", "SPEC.md", "README.md", "github.md", "serve.py", "tools/rank-history.jsonl",
             "tools/build-works.py", "tools/smoke-manga-wp.py", "docs/REVIEW-MANGA-WP.md", "_archive/README.md")


def resolves(path, files=None):
    """GitHub Pages と同じ解決: /a → a / a.html / a/index.html、/a/ → a/index.html"""
    files = PUBLIC if files is None else files
    p = path.lstrip("/")
    if p == "" or p.endswith("/"):
        return (p + "index.html") in files
    return p in files or (p + ".html") in files or (p + "/index.html") in files


def site_path(page, ref):
    """ページ内の参照をサイトのパスにする。相対参照はそのページの場所から解決する（ブラウザと同じ）"""
    u = urlsplit(ref)
    if u.scheme or u.netloc:
        return u.path if u.netloc == "bizmanga.contentsx.jp" else None
    path = u.path if u.path.startswith("/") else posixpath.join("/" + posixpath.dirname(page), u.path)
    norm = posixpath.normpath(unquote(path))
    return norm + "/" if path.endswith("/") and norm != "/" else norm


class SiteArtifact(unittest.TestCase):
    def test_internal_files_are_not_public(self):
        leaked = sorted(f for f in PUBLIC if re.search(
            r"\.(md|py|pyc|tpl|sh|ya?ml|json|jsonl|cjs|txt)$", f) and f not in bsa.ALLOWED_FILES)
        self.assertEqual(leaked, [])
        for must_hide in MUST_HIDE:
            self.assertNotIn(must_hide, PUBLIC)

    def test_pages_and_assets_are_public(self):
        for must_show in ("index.html", "404.html", "biz-library.html", "embed-viewer.html", "sw.js",
                          "robots.txt", "sitemap.xml", "feed.xml", "llms.txt", "manifest.json", "CNAME",
                          "js/works.js", "js/bm-wp-api.js", "js/bm-nav.js"):
            self.assertIn(must_show, PUBLIC)

    def test_site_path_resolution(self):
        self.assertEqual(site_path("index.html", "../css/x.css"), "/css/x.css")
        self.assertEqual(site_path("works/a.html", "img/h.webp"), "/works/img/h.webp")
        self.assertEqual(site_path("column/x.html", "/js/a.js"), "/js/a.js")
        self.assertIsNone(site_path("index.html", "https://example.com/a.js"))

    def test_local_references_resolve(self):
        missing = set()
        for rel in sorted(PUBLIC):
            if not rel.endswith((".html", ".css")):
                continue
            text = (ROOT / rel).read_text(encoding="utf-8", errors="ignore")
            for m in REF.finditer(text):
                ref = (m.group(1) or m.group(2) or "").strip()
                if not ref or ref.startswith(("data:", "mailto:", "tel:", "javascript:", "{{", "$", "+")):
                    continue
                path = site_path(rel, ref)
                # 公開の絞り込みで欠けたものだけを問題にする（リポジトリにも無い参照は対象外）
                if path and not resolves(path) and resolves(path, CANDIDATE_SET):
                    missing.add(f"{rel} -> {ref}")
        self.assertEqual(sorted(missing), [])


if __name__ == "__main__":
    unittest.main()
