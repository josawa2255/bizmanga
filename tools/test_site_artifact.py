"""公開ファイルの絞り込み（tools/build-site-artifact.py）の検査。デプロイ前に実行する（.github/workflows/pages.yml）。
- 内部資料（md・docs・スクリプト・テスト・順位の履歴）が公開対象に入っていない
- 公開する HTML / CSS が参照するサイト内ファイルが、公開対象から漏れていない
- IndexNow のキーファイルがサイト直下の /{KEY}.txt に、中身 KEY（tools/bm_indexnow.py）で出る
公開対象は collect()（公開候補の一覧）で確かめ、サイト全体はコピーしない。build() は小さな一覧で一時ディレクトリに
実行し、作るファイルの中身を確かめる（作業ツリーの _site/ は触らない）
python3 -m unittest discover -s tools -p test_site_artifact.py"""
import importlib.util
import io
import posixpath
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch
from urllib.parse import unquote, urlsplit

import bm_indexnow

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_site_artifact", ROOT / "tools" / "build-site-artifact.py")
bsa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bsa)

CANDIDATES, PUBLIC_LIST, GENERATED = bsa.collect()
CANDIDATE_SET = set(CANDIDATES)
PUBLIC = set(PUBLIC_LIST)                 # 許可リストを通るリポジトリのファイル
KEY_FILE = f"{bm_indexnow.KEY}.txt"       # IndexNow が取りに来るキーファイル（リポジトリには無い）
REF = re.compile(r'''(?:src|href|poster|content)\s*=\s*["']([^"'#?]+)|url\(\s*["']?([^"')#?]+)''', re.I)
MUST_HIDE = ("CLAUDE.md", "SPEC.md", "README.md", "github.md", "serve.py", "tools/rank-history.jsonl",
             "tools/build-works.py", "tools/smoke-manga-wp.py", "docs/REVIEW-MANGA-WP.md", "_archive/README.md",
             "tools/bm_indexnow.py", "tools/indexnow-ping.py")


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
        # pages.yml と同じ build() を、公開対象を数件に絞って一時ディレクトリへ出す（全体のコピーはしない）
        tmp = tempfile.TemporaryDirectory(prefix="bm-site-artifact-")
        cls.addClassCleanup(tmp.cleanup)
        cls.tmp = Path(tmp.name)
        cls.sample = ["CNAME", "index.html", "js/bm-nav.js"]
        cls.site = cls.tmp / "_site"
        (cls.site / "stale.txt").parent.mkdir(parents=True)
        (cls.site / "stale.txt").write_text("left from a previous build", encoding="utf-8")
        with patch.object(bsa, "tracked_files", return_value=cls.sample + ["CLAUDE.md", "tools/build-works.py"]):
            cls.result = bsa.build(cls.site)
        cls.built = {p.relative_to(cls.site).as_posix() for p in cls.site.rglob("*") if p.is_file()}

    def test_public_files_are_allowed_files_only(self):
        # 公開物 = 許可リストを通るリポジトリのファイル + IndexNow のキーファイル。ほかには何も出さない
        leaked = sorted(f for f in PUBLIC if re.search(
            r"\.(md|py|pyc|tpl|sh|ya?ml|json|jsonl|cjs|txt)$", f) and f not in bsa.ALLOWED_FILES)
        self.assertEqual(leaked, [])
        for must_hide in MUST_HIDE:
            self.assertNotIn(must_hide, PUBLIC)
            self.assertNotIn(must_hide, GENERATED)
        self.assertEqual(GENERATED, {KEY_FILE: bm_indexnow.KEY})
        self.assertFalse(KEY_FILE in CANDIDATE_SET, "the key file is generated, not kept in the repository")

    def test_pages_and_assets_are_public(self):
        for must_show in ("index.html", "404.html", "biz-library.html", "embed-viewer.html", "sw.js",
                          "robots.txt", "sitemap.xml", "feed.xml", "llms.txt", "manifest.json", "CNAME",
                          "js/works.js", "js/bm-wp-api.js", "js/bm-nav.js"):
            self.assertIn(must_show, PUBLIC)

    def test_build_copies_public_files_and_writes_the_key_file(self):
        files, public, generated = self.result
        self.assertEqual(public, self.sample)
        self.assertEqual(self.built, set(self.sample) | {KEY_FILE}, "the old output is removed first")
        for rel in self.sample:
            self.assertEqual((self.site / rel).read_bytes(), (ROOT / rel).read_bytes())
        # IndexNow は /{KEY}.txt を取りに来て、中身がキーと一致するかで所有を確かめる（改行を付けない）
        self.assertEqual((self.site / KEY_FILE).read_bytes(), bm_indexnow.KEY.encode("utf-8"))
        self.assertEqual(generated, {KEY_FILE: bm_indexnow.KEY})
        self.assertEqual(bm_indexnow.HOST, (ROOT / "CNAME").read_text(encoding="utf-8").strip())

    def test_list_includes_the_key_file(self):
        listing = io.StringIO()
        with patch.object(sys, "argv", ["build-site-artifact.py", "--list"]), redirect_stdout(listing):
            self.assertEqual(bsa.main(), 0)
        lines = listing.getvalue().splitlines()
        self.assertIn(KEY_FILE, lines)
        self.assertEqual(set(lines), PUBLIC | {KEY_FILE})

    def test_key_is_read_from_the_shared_module_at_call_time(self):
        # 送信（indexnow-ping.py）と公開物が同じ bm_indexnow を読む。KEY を替えればファイルも替わる
        with patch.object(bm_indexnow, "KEY", "0123456789abcdef-new"):
            self.assertEqual(bsa.generated_files(), {"0123456789abcdef-new.txt": "0123456789abcdef-new"})

    def test_invalid_key_skips_only_the_key_file(self):
        # IndexNow の設定ミスでサイト全体のデプロイを止めない（警告してキーファイルだけ出さない）
        for bad in ("short", "has space-1234", "../escape-1234", "a" * 129, "", None):
            with self.subTest(key=bad), patch.object(bm_indexnow, "KEY", bad):
                warning = io.StringIO()
                with redirect_stderr(warning):
                    self.assertEqual(bsa.generated_files(), {})
                self.assertIn("::warning::", warning.getvalue())
        site = self.tmp / "_site_bad_key"
        with patch.object(bm_indexnow, "KEY", "short"), redirect_stderr(io.StringIO()), \
                patch.object(bsa, "tracked_files", return_value=self.sample):
            bsa.build(site)
        self.assertEqual({p.relative_to(site).as_posix() for p in site.rglob("*") if p.is_file()}, set(self.sample))

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
