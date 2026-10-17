#!/usr/bin/env python3
"""BizManga RSS 2.0 フィード（/feed.xml）を手動で作り直す。

通常は、コラムのビルド（tools/build-columns.py。.github/workflows/build-columns.yml）がページを書き終えた後に、
同じ取得データで feed.xml を書く。このスクリプトは同じ関数（tools/bm_feed.py の write_feed）を使い、
コラムの一覧も同じ bm_content.fetch_columns で取り直して feed.xml だけを作る。
コラム0件・ID欠落・取得の途中失敗なら書かずに失敗し、既存の feed.xml を残す。

Usage:
  python3 tools/build-feed.py
"""
from pathlib import Path
import sys

import bm_content
import bm_feed
from bm_build import output_batch

ROOT = Path(__file__).resolve().parents[1]


def main():
    with output_batch(ROOT):
        columns = bm_content.fetch_columns()
        print(f"コラム: {len(columns)}件取得")
        count = bm_feed.write_feed(columns, ROOT)
    print(f"✓ {bm_feed.FEED_NAME} 生成完了（{count}件）")


if __name__ == "__main__":
    sys.exit(main() or 0)
