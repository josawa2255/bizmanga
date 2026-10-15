#!/usr/bin/env python3
"""GitHub Pages に公開するファイルだけを _site/ に集める（2026-10-14 セキュリティ強化）。

以前は GitHub Pages の「ブランチから公開」でリポジトリ全体を公開しており、内部資料（*.md・docs/・
生成スクリプト・テスト・順位の履歴）まで https://bizmanga.contentsx.jp/ から取得できた（ContentsX と同じ問題。
ContentX_HP/BUGS.md #067）。AI による偵察で構成や弱点を読まれないよう、**許可した種類のファイルだけ**を
公開する（知らない種類は公開しない側に倒す）。デプロイは .github/workflows/pages.yml。

IndexNow のキーファイルはリポジトリに置かず、ここで tools/indexnow-ping.py の KEY / KEY_LOCATION から作る
（正本は indexnow-ping.py の1か所。キーを替えるときは KEY だけ替えればよい）。

Usage:
  python3 tools/build-site-artifact.py            # _site/ を作り直す
  python3 tools/build-site-artifact.py --list     # 公開されるファイルの一覧だけ出す（作るキーファイルも含む）
"""
import argparse
import importlib.util
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"
INDEXNOW = ROOT / "tools" / "indexnow-ping.py"

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


class PublishError(Exception):
    """公開物を作れない設定の誤り（デプロイを止める）"""


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


def load_indexnow():
    """IndexNow の送信スクリプトを読み込む（main() は __name__ で守られているので送信はしない）"""
    spec = importlib.util.spec_from_file_location("indexnow_ping", INDEXNOW)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def generated_files(public):
    """リポジトリには置かず、ここで作って公開するファイル {公開パス: 中身}。
    IndexNow のキーファイル: KEY_LOCATION の場所に、中身が KEY のファイル（IndexNow はこの URL を取りに来て、
    中身がキーと一致するかで所有を確かめる）。送信が通らない値なら、ずれたまま公開せずデプロイを止める"""
    ping = load_indexnow()
    host = (ROOT / "CNAME").read_text(encoding="utf-8").strip()
    key, location = ping.KEY, urlsplit(ping.KEY_LOCATION)
    name = location.path[1:]
    problems = []
    if ping.HOST != host:
        problems.append(f"HOST {ping.HOST!r} がサイト（CNAME）の {host!r} と違う")
    if location.scheme != "https" or location.netloc != host or location.query or location.fragment:
        problems.append(f"KEY_LOCATION {ping.KEY_LOCATION!r} が https://{host}/ の上のファイルではない")
    # IndexNow はキーファイルの置き場所より下の URL しか受け付けない。サイト全体を送るので直下に置く
    elif not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*\.txt", name):
        problems.append(f"KEY_LOCATION のパス {location.path!r} はサイト直下の .txt にする（例: /{{KEY}}.txt）")
    elif name in public or name in ALLOWED_FILES:
        problems.append(f"KEY_LOCATION のパス {location.path!r} が公開する既存のファイルと重なる")
    if not re.fullmatch(r"[A-Za-z0-9-]{8,128}", key):
        problems.append("KEY は英数字とハイフンの 8〜128 文字にする（IndexNow の決まり）")
    if problems:
        raise PublishError("IndexNow のキーファイルを作れない（tools/indexnow-ping.py を直す）: " + " / ".join(problems))
    return {name: key}


def collect():
    """(候補, 公開するリポジトリのファイル, 作って公開するファイル)"""
    files = tracked_files()
    public = sorted(f for f in files if is_public(f))
    return files, public, generated_files(public)


def build(out=OUT):
    """out を作り直し、公開するファイルを集める。作ったものを返す"""
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
    try:
        if args.list:
            _, public, generated = collect()
            print("\n".join(sorted([*public, *generated])))
            return 0
        files, public, generated = build()
    except PublishError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(f"published {len(public)} of {len(files)} candidate files + generated {', '.join(sorted(generated))}"
          f" -> {OUT.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
