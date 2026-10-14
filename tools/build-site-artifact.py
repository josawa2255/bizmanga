#!/usr/bin/env python3
"""GitHub Pages に公開するファイルだけを _site/ に集める（2026-10-14 セキュリティ強化）。

以前は GitHub Pages の「ブランチから公開」でリポジトリ全体を公開しており、内部資料（*.md・docs/・
生成スクリプト・テスト・順位の履歴）まで https://bizmanga.contentsx.jp/ から取得できた（ContentsX と同じ問題。
ContentX_HP/BUGS.md #067）。AI による偵察で構成や弱点を読まれないよう、**許可した種類のファイルだけ**を
公開する（知らない種類は公開しない側に倒す）。デプロイは .github/workflows/pages.yml。

Usage:
  python3 tools/build-site-artifact.py            # _site/ を作り直す
  python3 tools/build-site-artifact.py --list     # 公開されるファイルの一覧だけ出す
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

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
# 拡張子では許可しないが、名前を指定して公開するもの
ALLOWED_FILES = {
    "CNAME", "robots.txt", "llms.txt", "manifest.json",
    "d3aa5088bd3c49f988a9c1ead3f8206a.txt",   # 検索エンジンの所有確認
}
# 中身に関係なく公開しないフォルダ（先頭一致）
DENY_DIRS = (
    "_archive/", "tools/", "docs/", "node_modules/", "_site/",
)


def tracked_files():
    """公開の候補: git 管理下のファイル＋.gitignore されていない新しいファイルのうち、いまディスクにあるもの。
    デプロイでは tools/build-services.py が先にページを作り直す（追加・削除がありうる）ので、
    コミット済みの一覧ではなく「作り直した後の作業ツリー」を正とする。.gitignore 対象（秘密・作業ファイル）は拾わない"""
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()
    files = tracked_files()
    public = sorted(f for f in files if is_public(f))
    if args.list:
        print("\n".join(public))
        return 0
    if OUT.exists():
        shutil.rmtree(OUT)
    for rel in public:
        src, dst = ROOT / rel, OUT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    print(f"published {len(public)} of {len(files)} candidate files -> {OUT.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
