#!/usr/bin/env python3
"""
BizManga コラム静的HTMLビルダー

WP API `/columns` からコラム記事を取得し、以下を自動生成する:
  1. column/{slug}.html 個別ページを生成（SEOフレンドリーURL）
  2. column.html 内の <!-- BUILD:COLUMN_GRID --> マーカー間に静的カードを展開
  3. sitemap.xml に個別コラムURLを追加
  4. column.html head に ItemList JSON-LD を挿入

使い方:
    cd BizManga
    python3 tools/build-columns.py

実行タイミング:
    - WordPress でコラムを追加・更新した後
    - 週1回の定期実行（GitHub Actions）
"""

import html
import json
import pathlib
import re
import sys
import unicodedata
import urllib.request

API_LIST = "https://cms.contentsx.jp/wp-json/contentsx/v1/columns?site=bizmanga&per_page=100"

# 日本語タイトル → 英語風スラッグ自動変換マップ
# WP側でスラッグ設定が面倒なので、ビルド時にタイトルからスラッグを自動生成する
SLUG_MAP = {
    "4コマ漫画をビジネス活用するには": "4koma-business-guide",
    "4コマ漫画の簡単な作り方とビジネス活用法": "4koma-howto",
    "ビジネス漫画の効果とは": "business-manga-effect",
    "漫画の「プロット」とは": "manga-plot-guide",
    "なぜ今、ビジネスに漫画なのか": "why-business-manga",
}


def make_slug(column):
    """WPスラッグが日本語ならSLUG_MAPまたはIDベースで英語化"""
    slug = column.get("slug") or ""
    # ASCII のみなら既に英語スラッグ
    if slug and slug.isascii() and "%" not in slug:
        return slug
    # タイトルからマップ検索
    title = column.get("title_ja") or ""
    for key, val in SLUG_MAP.items():
        if key in title:
            return val
    # フォールバック: post ID ベース
    return f"column-{column['id']}"
API_SINGLE = "https://cms.contentsx.jp/wp-json/contentsx/v1/columns/{id}"
SITE = "https://bizmanga.contentsx.jp"
ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE_PATH = ROOT / "tools" / "templates" / "column-detail.html.tpl"
COLUMN_DIR = ROOT / "column"


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "BizManga-Builder/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_columns():
    data = fetch_json(API_LIST)
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected API response: {type(data)}")
    return data


def fetch_column_detail(col_id):
    return fetch_json(API_SINGLE.format(id=col_id))


def estimate_readtime(text):
    """本文文字数から日本語読了時間を推定 (600字/分、最小3分)"""
    if not text:
        return 3
    plain = re.sub(r"<[^>]+>", "", text)
    plain = re.sub(r"\s+", "", plain)
    minutes = max(3, round(len(plain) / 600))
    return minutes


def build_card(c):
    slug = make_slug(c)
    thumb = c.get("thumbnail") or f"{SITE}/material/images/og/og-index.webp"
    title_ja = c.get("title_ja", "")
    category = c.get("category") or "その他"
    excerpt = c.get("excerpt_ja", "")
    date = c.get("date", "")
    readtime = c.get("_readtime", 5)
    detail_url = f"/column/{slug}"

    cat_html = (
        f'<span class="bm-column-card-cat">{esc(category)}</span>' if c.get("category") else ""
    )
    return (
        f'      <a class="bm-column-card" href="{esc(detail_url)}" data-category="{esc(category)}">\n'
        f'        <div class="bm-column-card-img">\n'
        f'          <img src="{esc(thumb)}" alt="{esc(title_ja)}" loading="lazy" width="400" height="225">\n'
        f'        </div>\n'
        f'        <div class="bm-column-card-body">\n'
        f'          {cat_html}\n'
        f'          <h3 class="bm-column-card-title">{esc(title_ja)}</h3>\n'
        f'          <p class="bm-column-card-excerpt">{esc(excerpt)}</p>\n'
        f'          <div class="bm-column-card-meta">\n'
        f'            <span class="bm-column-card-readtime">{readtime}分</span>\n'
        f'            <time class="bm-column-card-date">{esc(date)}</time>\n'
        f'          </div>\n'
        f'        </div>\n'
        f'      </a>\n'
    )


def update_column_html(columns):
    p = ROOT / "column.html"
    if not p.exists():
        print(f"SKIP: {p} not found")
        return
    s = p.read_text(encoding="utf-8")

    # Featured = 最新1件 (日付降順の先頭)
    featured = columns[0] if columns else None
    rest = columns[1:] if featured else columns

    cards = "".join(build_card(c) for c in rest)
    start = "<!-- BUILD:COLUMN_GRID -->"
    end = "<!-- /BUILD:COLUMN_GRID -->"
    block = f"{start}\n{cards}      {end}"
    pattern = re.compile(re.escape(start) + r"[\s\S]*?" + re.escape(end))
    if pattern.search(s):
        s = pattern.sub(block, s)

    # Featured + カテゴリ一覧をJSONで埋め込む (bm-column-filter.jsが読む)
    cat_counts = {}
    for c in columns:
        k = c.get("category") or "その他"
        cat_counts[k] = cat_counts.get(k, 0) + 1
    # カテゴリ一覧は件数降順、"その他"は末尾
    sorted_cats = sorted(
        [{"name": k, "count": v} for k, v in cat_counts.items()],
        key=lambda x: (x["name"] == "その他", -x["count"]),
    )
    data_payload = {
        "total": len(columns),
        "categories": sorted_cats,
        "featured": {
            "slug": make_slug(featured),
            "title": featured.get("title_ja", ""),
            "excerpt": featured.get("excerpt_ja", ""),
            "thumbnail": featured.get("thumbnail") or f"{SITE}/material/images/og/og-index.webp",
            "category": featured.get("category") or "",
            "date": featured.get("date", ""),
            "readtime": featured.get("_readtime", 5),
        } if featured else None,
    }
    data_tag = (
        '<script type="application/json" id="bm-column-data">\n'
        + json.dumps(data_payload, ensure_ascii=False, indent=2)
        + "\n</script>"
    )
    data_pattern = re.compile(
        r'<script type="application/json" id="bm-column-data">[\s\S]*?</script>'
    )
    if data_pattern.search(s):
        s = data_pattern.sub(data_tag, s)
    else:
        s = s.replace("</head>", f"  {data_tag}\n</head>", 1)

    # ItemList JSON-LD
    ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "BizManga コラム一覧",
        "numberOfItems": len(columns),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i,
                "url": f"{SITE}/column/{make_slug(c)}",
                "name": c.get("title_ja") or str(c["id"]),
            }
            for i, c in enumerate(columns, start=1)
        ],
    }
    ld_tag = (
        '<script type="application/ld+json" id="column-itemlist-ld">\n'
        + json.dumps(ld, ensure_ascii=False, indent=2)
        + "\n</script>"
    )
    ld_pattern = re.compile(
        r'<script type="application/ld\+json" id="column-itemlist-ld">[\s\S]*?</script>'
    )
    if ld_pattern.search(s):
        s = ld_pattern.sub(ld_tag, s)
    else:
        s = s.replace("</head>", f"  {ld_tag}\n</head>", 1)

    p.write_text(s, encoding="utf-8")
    print(f"Updated {p}")


def build_detail_page(col, detail_data, template):
    slug = make_slug(col)
    title_ja = col.get("title_ja") or slug
    thumb = col.get("thumbnail") or f"{SITE}/material/images/og/og-index.webp"
    category = col.get("category") or ""
    date = col.get("date") or ""
    date_ymd = col.get("date_ymd") or ""
    # WP 側の post_modified が全記事同日付（今日）になってしまうケースが多く、
    # dateModified が全記事一律「今日」だと QRG 的に不自然シグナル。
    # WP modified が「今日の日付」と一致する間は、信頼せず date_ymd にフォールバック。
    # WP 側で個別記事の modified が正しく反映されるようになったらこのロジックを緩める。
    from datetime import date as _date
    today_iso = _date.today().isoformat()
    wp_modified = col.get("modified_ymd") or ""
    if wp_modified and wp_modified != today_iso and wp_modified >= date_ymd:
        modified_ymd = wp_modified
    else:
        modified_ymd = date_ymd
    excerpt = col.get("excerpt_ja") or ""
    content = detail_data.get("content") or ""

    raw_desc = re.sub(r"<[^>]+>", "", excerpt or content).replace("\n", " ").strip()
    description = (raw_desc or f"{title_ja}｜ビズマンガ コラム")[:150]

    cat_html = (
        f'<span class="bm-col-static-cat">{esc(category)}</span>' if category else ""
    )
    hero_html = ""
    if thumb:
        hero_html = (
            f'<figure class="bm-col-static-hero">'
            f'<img src="{esc(thumb)}" alt="{esc(title_ja)}" loading="eager">'
            f'</figure>'
        )

    replacements = {
        "{{slug}}": esc(slug),
        "{{title_ja}}": esc(title_ja),
        "{{description}}": esc(description),
        "{{thumbnail}}": esc(thumb),
        "{{category}}": esc(category),
        "{{category_html}}": cat_html,
        "{{date}}": esc(date),
        "{{date_ymd}}": esc(date_ymd),
        "{{modified_ymd}}": esc(modified_ymd),
        "{{url}}": f"{SITE}/column/{slug}",
        "{{hero_html}}": hero_html,
        "{{content_html}}": content,
    }

    out = template
    for k, v in replacements.items():
        out = out.replace(k, v)
    return out


def generate_details(columns):
    if not TEMPLATE_PATH.exists():
        print(f"ERROR: template not found: {TEMPLATE_PATH}", file=sys.stderr)
        sys.exit(1)
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    COLUMN_DIR.mkdir(exist_ok=True)

    current_slugs = set()
    for c in columns:
        slug = make_slug(c)
        current_slugs.add(slug)

        try:
            detail = fetch_column_detail(c["id"])
        except Exception as e:
            print(f"  WARN: failed to fetch detail for {slug}: {e}")
            continue

        # 読了時間を算出してc._readtimeへキャッシュ (update_column_htmlで使用)
        c["_readtime"] = estimate_readtime(detail.get("content", ""))

        out = build_detail_page(c, detail, template)
        (COLUMN_DIR / f"{slug}.html").write_text(out, encoding="utf-8")
        print(f"  Generated column/{slug}.html")

    removed = 0
    for existing in COLUMN_DIR.glob("*.html"):
        if existing.stem == "index":
            continue
        if existing.stem not in current_slugs:
            existing.unlink()
            removed += 1

    print(f"Generated {len(columns)} column pages, removed {removed} stale files")


def update_sitemap(columns):
    p = ROOT / "sitemap.xml"
    if not p.exists():
        print(f"SKIP: {p} not found")
        return
    s = p.read_text(encoding="utf-8")

    pattern = re.compile(
        r"\s*<!-- BUILD:COLUMNS[^>]*?-->[\s\S]*?<!-- /BUILD:COLUMNS -->\s*"
    )
    s = pattern.sub("\n\n", s)

    entries = []
    for c in columns:
        slug = make_slug(c)
        entries.append(
            "  <url>\n"
            f"    <loc>{SITE}/column/{slug}</loc>\n"
            "    <changefreq>monthly</changefreq>\n"
            "    <priority>0.6</priority>\n"
            "  </url>"
        )
    block = (
        "  <!-- BUILD:COLUMNS (auto-generated by tools/build-columns.py) -->\n"
        + "\n".join(entries)
        + "\n  <!-- /BUILD:COLUMNS -->\n"
    )
    s = s.replace("</urlset>", block + "\n</urlset>")
    p.write_text(s, encoding="utf-8")
    print(f"Updated {p}")


def main():
    try:
        columns = fetch_columns()
    except Exception as e:
        print(f"ERROR fetching columns: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Total columns from WP: {len(columns)}")
    if not columns:
        print("No columns found. Skipping build.")
        return

    # 順序: detail生成 (readtimeを記録) → column.html 更新 → sitemap
    generate_details(columns)
    update_column_html(columns)
    update_sitemap(columns)
    print("Done.")


if __name__ == "__main__":
    main()
