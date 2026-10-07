"""Canonical column URLs shared by page and feed builders."""
import sys

from bm_build import safe_slug

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
