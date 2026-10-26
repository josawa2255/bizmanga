"""Canonical column URLs shared by page and feed builders."""
from datetime import date, datetime, timedelta, timezone
import sys

from bm_build import API_BASE, safe_slug

# The column pages and the RSS feed must list the same articles.
COLUMNS_API = API_BASE + "/columns?site=bizmanga&per_page=100"

SLUG_MAP = {
    "4コマ漫画をビジネス活用するには": "4koma-business-guide",
    "4コマ漫画の簡単な作り方とビジネス活用法": "4koma-howto",
    "ビジネス漫画の効果とは": "business-manga-effect",
    "漫画の「プロット」とは": "manga-plot-guide",
    "なぜ今、ビジネスに漫画なのか": "why-business-manga",
}


def make_slug(column):
    slug = column.get("slug") or ""
    if slug:
        try:
            return safe_slug(slug)
        except ValueError:
            # 公開URLが変わるので黙って切り替えない（Actions の画面に警告を出す）
            print(f"::warning::column {column.get('id')}: slug {slug!r} is not a safe URL; "
                  "falling back to another URL. Fix the slug in WordPress.", file=sys.stderr)
    title = column.get("title_ja") or ""
    for key, val in SLUG_MAP.items():
        if key in title:
            return val
    return safe_slug(f"column-{column['id']}")


def column_modified_ymd(column, today=None):
    """コラムの更新日（YYYY-MM-DD）。記事ページ（dateModified 等）・sitemap の lastmod・RSS の並び順で共通に使う。

    WP の modified_ymd は次の場合に信用せず、公開日（date_ymd）にする:
      - 公開日より前（予約投稿などで公開前に保存した日が入る。sitemap が公開日より前の lastmod を出していた、Issue #86）
      - 今日（WP 側で全記事の更新日が一括で「今日」になることがあるため。翌日のビルドで反映される）。
        「今日」は日本時間で数える（GitHub のランナーは UTC で、03:00 JST のビルドでは前日扱いがずれるため）
    """
    published = column.get("date_ymd") or ""
    modified = column.get("modified_ymd") or ""
    today = today or datetime.now(timezone(timedelta(hours=9))).date().isoformat()
    if modified and modified != today and modified >= published:
        return modified
    return published
