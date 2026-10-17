#!/usr/bin/env python3
"""GitHub Pages に公開するファイルだけを _site/ に集める（2026-10-14 セキュリティ強化）。

以前は GitHub Pages の「ブランチから公開」でリポジトリ全体を公開しており、内部資料（*.md・docs/・
生成スクリプト・テスト・順位の履歴）まで https://bizmanga.contentsx.jp/ から取得できた（ContentsX と同じ問題。
ContentX_HP/BUGS.md #067）。AI による偵察で構成や弱点を読まれないよう、**許可した種類のファイルだけ**を
公開する（知らない種類は公開しない側に倒す）。デプロイは .github/workflows/pages.yml。

IndexNow のキーファイルはリポジトリに置かず、ここで tools/bm_indexnow.py の KEY から作る
（サイト直下の /{KEY}.txt、中身は KEY だけ。キーを替えるときは bm_indexnow.py の KEY だけ替えればよい）。

Usage:
  python3 tools/build-site-artifact.py            # _site/ を作り直す
  python3 tools/build-site-artifact.py --list     # 公開されるファイルの一覧だけ出す（作るキーファイルも含む）
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import bm_indexnow

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"

# 公開してよい拡張子（小文字）
ALLOWED_EXT = {
    ".html", ".css", ".js",
    ".webp", ".avif", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".mp4", ".webm", ".vtt",
    ".woff", ".woff2",
    ".pdf",          # 資料ダウンロード（material/docs/）
    ".xml",          # sitemap.xml / feed.xml
}
# 拡張子では許可しないが、名前を指定して公開するもの（IndexNow のキーファイルは generated_files() が作る）
ALLOWED_FILES = {
    "CNAME", "robots.txt", "llms.txt", "manifest.json",
}
# 中身に関係なく公開しないフォルダ（先頭一致）
DENY_DIRS = (
    "_archive/", "tools/", "docs/", "node_modules/", "_site/",
)


def tracked_files():
    """公開の候補: git 管理下のファイル＋.gitignore されていない新しいファイル（--others）のうち、いまディスクにあるもの。
    .gitignore 対象（秘密・作業ファイル）は拾わない。
    CI（pages.yml・checks.yml）はコミットをチェックアウトするので、候補はコミット済みのファイルだけ。
    手元では git add していない新しいファイルも候補に入るため、手元の _site/・--list・test_site_artifact.py は
    CI と結果が変わることがある。git add し忘れたファイルは手元では公開対象に見えて検査も通るが、本番には出ない。
    この漏れは手元では検出できない。CI では、JS・CSS の参照なら checks.yml の check-site.py で落ちるが、
    画像などは test_site_artifact.py の参照検査が「リポジトリに無い参照」として対象外にするので落ちず、本番で 404 になる"""
    out = subprocess.run(["git", "-c", "core.quotepath=false", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                         cwd=ROOT, capture_output=True, check=True).stdout.decode("utf-8")
    return sorted({p for p in out.split("\0") if p and (ROOT / p).is_file()})


def is_public(rel):
    if rel.startswith(".") or "/." in rel:          # .github/ .claude/ .gitignore など
        return False
    if rel.startswith(DENY_DIRS):
        return False
    if rel in ALLOWED_FILES:
        return True
    return Path(rel).suffix.lower() in ALLOWED_EXT


def generated_files():
    """リポジトリには置かず、ここで作って公開するファイル {公開パス: 中身}。
    IndexNow のキーファイル: サイト直下の {KEY}.txt に、中身 KEY（改行なし）。
    KEY の書式が IndexNow の決まりに合わなければ警告して、キーファイルだけ出さない
    （IndexNow の設定ミスでサイト全体のデプロイを止めない。送信側も同じ検査で送らない）。"""
    try:
        name = bm_indexnow.key_file_name()
    except ValueError as error:
        print(f"::warning::IndexNow key file is not published: {error}", file=sys.stderr)
        return {}
    return {name: bm_indexnow.KEY}


def collect():
    """(候補, 公開するリポジトリのファイル, 作って公開するファイル)"""
    files = tracked_files()
    public = sorted(f for f in files if is_public(f))
    return files, public, generated_files()


def build(out=None):
    """out（既定は _site/）を作り直し、公開するファイルを集める。(候補, 公開するファイル, 作ったファイル) を返す"""
    out = OUT if out is None else Path(out)
    files, public, generated = collect()
    if out.exists():
        shutil.rmtree(out)
    for rel in public:
        src, dst = ROOT / rel, out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    for rel, text in generated.items():
        dst = out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(text.encode("utf-8"))      # 改行を付けない（中身はキーだけ）
    return files, public, generated


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()
    if args.list:
        _, public, generated = collect()
        print("\n".join(sorted([*public, *generated])))
        return 0
    files, public, generated = build()
    print(f"published {len(public)} of {len(files)} candidate files"
          f" + generated {', '.join(sorted(generated)) or 'nothing'} -> {OUT.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
