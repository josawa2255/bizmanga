"""公開ファイルの絞り込み（tools/build-site-artifact.py）の検査。デプロイ前に実行する（.github/workflows/pages.yml）。
- 内部資料（md・docs・スクリプト・テスト・順位の履歴）が公開対象に入っていない
- 公開する HTML / CSS が参照するサイト内ファイルが、公開対象から漏れていない
- IndexNow のキーファイルが tools/indexnow-ping.py の KEY_LOCATION の場所に、中身 KEY で出る
公開物は build() で一時ディレクトリに作って確かめる（作業ツリーの _site/ は触らない）
python3 -m unittest discover -s tools -p test_site_artifact.py"""
import importlib.util
import io
import posixpath
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_site_artifact", ROOT / "tools" / "build-site-artifact.py")
bsa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bsa)

CANDIDATES = bsa.tracked_files()
CANDIDATE_SET = set(CANDIDATES)
PUBLIC = {f for f in CANDIDATES if bsa.is_public(f)}      # 許可リストを通るリポジトリのファイル
INDEXNOW = bsa.load_indexnow()
KEY_FILE = urlsplit(INDEXNOW.KEY_LOCATION).path.lstrip("/")  # IndexNow が取りに来るキーファイル（リポジトリには無い）
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
    @classmethod
    def setUpClass(cls):
        # pages.yml と同じ build() を一時ディレクトリへ出す
        cls.tmp = tempfile.TemporaryDirectory(prefix="bm-site-artifact-")
        cls.site = Path(cls.tmp.name) / "_site"
        bsa.build(cls.site)
        cls.built = {p.relative_to(cls.site).as_posix() for p in cls.site.rglob("*") if p.is_file()}

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_artifact_is_allowed_files_and_key_file(self):
        # 公開物 = 許可リストを通るリポジトリのファイル + IndexNow のキーファイル。ほかには何も出さない
        self.assertEqual(self.built, PUBLIC | {KEY_FILE})

    def test_internal_files_are_not_public(self):
        leaked = sorted(f for f in self.built if re.search(
            r"\.(md|py|pyc|tpl|sh|ya?ml|json|jsonl|cjs|txt)$", f) and f not in bsa.ALLOWED_FILES and f != KEY_FILE)
        self.assertEqual(leaked, [])
        for must_hide in MUST_HIDE:
            self.assertNotIn(must_hide, self.built)

    def test_pages_and_assets_are_public(self):
        for must_show in ("index.html", "404.html", "biz-library.html", "embed-viewer.html", "sw.js",
                          "robots.txt", "sitemap.xml", "feed.xml", "llms.txt", "manifest.json", "CNAME",
                          "js/works.js", "js/bm-wp-api.js", "js/bm-nav.js"):
            self.assertIn(must_show, self.built)

    def test_indexnow_key_file_is_published(self):
        # IndexNow は KEY_LOCATION を取りに来て、中身が KEY と一致するかで所有を確かめる
        self.assertEqual(urlsplit(INDEXNOW.KEY_LOCATION).netloc, (ROOT / "CNAME").read_text(encoding="utf-8").strip())
        self.assertEqual((self.site / KEY_FILE).read_bytes(), INDEXNOW.KEY.encode("utf-8"))
        listing = io.StringIO()
        with patch.object(sys, "argv", ["build-site-artifact.py", "--list"]), redirect_stdout(listing):
            self.assertEqual(bsa.main(), 0)
        self.assertIn(KEY_FILE, listing.getvalue().splitlines())

    def test_unusable_key_location_stops_publishing(self):
        host, key = INDEXNOW.HOST, INDEXNOW.KEY
        good = {"HOST": host, "KEY": key, "KEY_LOCATION": f"https://{host}/{key}.txt"}
        with patch.object(bsa, "load_indexnow", return_value=SimpleNamespace(**good)):
            self.assertEqual(bsa.generated_files(PUBLIC), {f"{key}.txt": key})
        for bad in ({"KEY_LOCATION": f"https://example.com/{key}.txt"}, {"HOST": "example.com"},
                    {"KEY_LOCATION": f"http://{host}/{key}.txt"}, {"KEY_LOCATION": f"https://{host}/keys/{key}.txt"},
                    {"KEY_LOCATION": f"https://{host}/../{key}.txt"}, {"KEY_LOCATION": f"https://{host}/robots.txt"},
                    {"KEY_LOCATION": f"https://{host}/{key}.txt?x=1"}, {"KEY": "short"}):
            with self.subTest(bad), \
                    patch.object(bsa, "load_indexnow", return_value=SimpleNamespace(**{**good, **bad})), \
                    self.assertRaises(bsa.PublishError):
                bsa.generated_files(PUBLIC)

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
