#!/usr/bin/env python3
"""IndexNow ping. push 全体で変更されたHTML/sitemap/llmsをBing/Yandexへ通知。
GitHub Actions は INDEXNOW_BEFORE / AFTER を渡す。ローカルでは直前コミット。
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
    """push の全コミットで変わったファイル → URL に変換"""
    before = os.environ.get("INDEXNOW_BEFORE")
    after = os.environ.get("INDEXNOW_AFTER")
    if before or after:
        if not all(re.fullmatch(r"[0-9a-fA-F]{40,64}", v or "") for v in (before, after)):
            raise ValueError("IndexNow commit IDs must be full hexadecimal hashes")
        command = (["git", "ls-tree", "-r", "--name-only", after]
                   if not before.strip("0") else
                   ["git", "diff", "--name-only", before, after, "--"])
    else:
        command = ["git", "diff", "--name-only", "HEAD~1", "HEAD", "--"]
    try:
        out = subprocess.check_output(command, text=True)
    except subprocess.CalledProcessError:
        # before が手元に無い（強制push後など）。黙って0件にせず直前コミットとの差分で通知する
        print("::warning::IndexNow: push range unavailable; falling back to the last commit",
              file=sys.stderr)
        out = subprocess.check_output(["git", "diff", "--name-only", "HEAD~1", "HEAD", "--"], text=True)
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
