#!/usr/bin/env python3
"""IndexNow ping. 直前コミットで変更されたHTML/sitemap/llmsをBing/Yandexへ即通知。
GitHub Actions から呼ばれる前提（HEAD~1 との diff を取る）。
"""
import json
import os
import re
import subprocess
import sys
import urllib.request

HOST = "bizmanga.contentsx.jp"
KEY = "d3aa5088bd3c49f988a9c1ead3f8206a"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"

def get_changed_urls():
    """直前のコミットで変わったファイル → URL に変換"""
    try:
        out = subprocess.check_output(
            ["git", "diff", "--name-only", "HEAD~1", "HEAD"],
            text=True
        )
    except subprocess.CalledProcessError:
        return []
    urls = []
    for f in out.splitlines():
        f = f.strip()
        if not re.search(r"\.(html|xml|txt)$", f):
            continue
        if f == "index.html":
            urls.append(f"https://{HOST}/")
        elif f.endswith(".html"):
            slug = f[:-5]  # remove .html
            urls.append(f"https://{HOST}/{slug}")
        elif f in ("sitemap.xml", "llms.txt", "robots.txt"):
            urls.append(f"https://{HOST}/{f}")
    return list(dict.fromkeys(urls))  # dedup, preserve order

def main():
    urls = get_changed_urls()
    if not urls:
        print("No relevant URL changes.")
        return 0
    if len(urls) > 10000:
        urls = urls[:10000]

    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
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
