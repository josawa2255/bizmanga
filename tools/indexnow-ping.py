#!/usr/bin/env python3
"""IndexNow への送信。公開で変わった HTML・sitemap.xml・llms.txt・robots.txt の URL を Bing / Yandex などへ知らせる。

送るのは公開（.github/workflows/pages.yml）が成功した後の1か所だけ。pages.yml は env で
INDEXNOW_BEFORE（前回成功した github-pages のデプロイのコミット）と INDEXNOW_AFTER（今回公開したコミット）を渡す。
前回が分からないときは pages.yml がこのスクリプトを呼ばない（全件は送らない）。
差分は名前の変更を「削除＋追加」として数える（--no-renames。slug の変更で消えた URL も送る）。
手元で env なしに実行すると直前のコミット（HEAD~1..HEAD）を送る。
サイトとキーは tools/bm_indexnow.py（キーファイルは公開時に build-site-artifact.py が作る）。
"""
import json
import os
import re
import subprocess
import sys
import urllib.request

import bm_indexnow


def get_changed_urls():
    """before〜after で変わったファイル → URL"""
    before = os.environ.get("INDEXNOW_BEFORE")
    after = os.environ.get("INDEXNOW_AFTER")
    if before or after:
        if not all(re.fullmatch(r"[0-9a-fA-F]{40,64}", v or "") and (v or "").strip("0") for v in (before, after)):
            raise ValueError("IndexNow commit IDs must be full, non-zero hexadecimal hashes")
    else:
        before, after = "HEAD~1", "HEAD"
    out = subprocess.check_output(["git", "diff", "--name-only", "--no-renames", before, after, "--"], text=True)
    host = bm_indexnow.HOST
    urls = []
    for f in out.splitlines():
        f = f.strip()
        if not re.search(r"\.(html|xml|txt)$", f):
            continue
        if f == "index.html":
            urls.append(f"https://{host}/")
        elif f.endswith(".html"):
            slug = f[:-5]  # remove .html
            urls.append(f"https://{host}/{slug}")
        elif f in ("sitemap.xml", "llms.txt", "robots.txt"):
            urls.append(f"https://{host}/{f}")
    return list(dict.fromkeys(urls))  # dedup, preserve order


def main():
    try:
        bm_indexnow.key_file_name()     # 公開されないキーでは送らない
    except ValueError as e:
        print(f"IndexNow error: {e}", file=sys.stderr)
        return 1
    urls = get_changed_urls()
    if not urls:
        print("No relevant URL changes.")
        return 0
    if len(urls) > 10000:
        urls = urls[:10000]

    payload = {
        "host": bm_indexnow.HOST,
        "key": bm_indexnow.KEY,
        "urlList": urls,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.indexnow.org/IndexNow",
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"IndexNow status={resp.status} urls={len(urls)}")
    except Exception as e:
        print(f"IndexNow error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
