#!/usr/bin/env python3
"""
GSC Search Analytics 日次ランク追跡スクリプト

- GitHub Actions から毎日実行
- Secrets: GSC_CLIENT_ID / GSC_CLIENT_SECRET / GSC_REFRESH_TOKEN
- ターゲットキーワードごとの position / clicks / impressions を取得
- tools/rank-history.jsonl に1行追記
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

SITES = [
    "https://bizmanga.contentsx.jp/",
    "https://contentsx.jp/",
]

TARGET_QUERIES = [
    "BtoBマンガ",
    "BtoB マンガ",
    "ビジネスマンガ 制作",
    "ビジネスマンガ制作",
    "ビジネス漫画 制作",
    "BtoB漫画 制作",
    "BtoBマンガ 制作",
    "ビジネスマンガ",
    "ビジネス漫画",
    "ビズマンガ",
    "contentsx",
    "コンテンツエックス",
]

HISTORY_FILE = Path(__file__).resolve().parent / "rank-history.jsonl"


def get_access_token():
    # GitHub Secrets のコピペ時に末尾改行/空白が混入することがあるため strip
    client_id = os.environ["GSC_CLIENT_ID"].strip()
    client_secret = os.environ["GSC_CLIENT_SECRET"].strip()
    refresh_token = os.environ["GSC_REFRESH_TOKEN"].strip()
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            resp = json.loads(r.read())
        return resp["access_token"]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"OAuth token refresh failed: HTTP {e.code}", file=sys.stderr)
        print(f"Response body: {body}", file=sys.stderr)
        print(f"client_id length: {len(client_id)}, secret length: {len(client_secret)}, refresh_token length: {len(refresh_token)}", file=sys.stderr)
        raise


def query_sa(site, start, end, access_token, dimensions=("query",), row_limit=5000):
    body = {
        "startDate": start,
        "endDate": end,
        "dimensions": list(dimensions),
        "rowLimit": row_limit,
    }
    url = (
        "https://www.googleapis.com/webmasters/v3/sites/"
        f"{urllib.parse.quote(site, safe='')}/searchAnalytics/query"
    )
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def collect_rankings(access_token):
    end = date.today() - timedelta(days=2)
    start = end - timedelta(days=7)

    snapshot = {
        "run_date": date.today().isoformat(),
        "data_window_start": start.isoformat(),
        "data_window_end": end.isoformat(),
        "sites": {},
    }

    for site in SITES:
        try:
            data = query_sa(site, str(start), str(end), access_token, ("query",), 5000)
        except Exception as e:
            snapshot["sites"][site] = {"error": str(e)}
            continue

        rows = data.get("rows", [])
        by_query = {r["keys"][0]: r for r in rows if r.get("keys")}

        target_data = {}
        for q in TARGET_QUERIES:
            r = by_query.get(q)
            if r:
                target_data[q] = {
                    "clicks": int(r.get("clicks", 0)),
                    "impressions": int(r.get("impressions", 0)),
                    "ctr": round(r.get("ctr", 0), 4),
                    "position": round(r.get("position", 0), 1),
                }
            else:
                target_data[q] = None

        snapshot["sites"][site] = {
            "targets": target_data,
            "top10": [
                {
                    "query": r["keys"][0],
                    "clicks": int(r.get("clicks", 0)),
                    "impressions": int(r.get("impressions", 0)),
                    "position": round(r.get("position", 0), 1),
                }
                for r in sorted(rows, key=lambda x: -x.get("clicks", 0))[:10]
            ],
        }

    return snapshot


def append_history(snapshot):
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with HISTORY_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(snapshot, ensure_ascii=False) + "\n")


def main():
    try:
        access_token = get_access_token()
    except Exception as e:
        print(f"Failed to refresh access token: {e}", file=sys.stderr)
        sys.exit(1)

    snapshot = collect_rankings(access_token)
    append_history(snapshot)

    print(f"Rank snapshot saved: {snapshot['run_date']}")
    for site, data in snapshot["sites"].items():
        print(f"\n=== {site} ===")
        if "error" in data:
            print(f"  ERROR: {data['error']}")
            continue
        for q, row in data["targets"].items():
            if row:
                print(f"  [{q}] pos={row['position']} clicks={row['clicks']} impr={row['impressions']}")
            else:
                print(f"  [{q}] no data")


if __name__ == "__main__":
    main()
