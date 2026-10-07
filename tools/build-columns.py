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
    - 日次の定期実行（GitHub Actions）
"""

import pathlib
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date as _date

from bm_brand import normalize_brand_text
from bm_build import (
    API_BASE,
    SITE_URL,
    output_batch,
    prune_stale,
    render_template,
    replace_grid,
    replace_json_script,
    require_records,
    write_text,
)
from bm_build import (
    escape_html as esc,
)
from bm_build import (
    fetch_json as _fetch_json,
)
from bm_content import make_slug
from bm_html import sanitize_html
from bm_pricing import normalize_price_html, normalize_price_text, write_browser_script
from bm_sitemap import append_blocks, build_block, remove_blocks, url_entry

# WP excerpt が誤っているコラムの description override (再ビルド時の上書き対策)
DESC_OVERRIDES = {
    "business-manga-production-guide": "ビジネスマンガ制作の完全ガイド。企画ヒアリング・シナリオ設計・ネーム・作画・修正・納品の7ステップと、業界相場40,000〜100,000円/ページに対するビズマンガ1ページ25,740円〜（税抜・原稿料別途）の透明料金体系を解説。発注前に読むべき完全マニュアル。",
}


API_LIST = API_BASE + '/columns?site=bizmanga&per_page=100'
API_SINGLE = API_BASE + '/columns/{id}'
SITE = SITE_URL
ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE_PATH = ROOT / "tools" / "templates" / "column-detail.html.tpl"
COLUMN_DIR = ROOT / "column"

DETAIL_FETCH_WORKERS = 5


def sanitize_content_html(raw):
    """WP本文HTMLをallowlistでサニタイズし、ブランド方針で正規化して返す。"""
    if not raw:
        return ""
    # 料金文言がstrong等で分かれていても揃える。タグ・URLは変更しない。
    return normalize_brand_text(normalize_price_html(sanitize_html(raw)), prices=False)


def fetch_columns():
    return require_records(_fetch_json(API_LIST), label="columns")


def fetch_column_detail(col_id):
    return _fetch_json(API_SINGLE.format(id=col_id))


def estimate_readtime(text):
    """本文文字数から日本語読了時間を推定 (600字/分、最小3分)"""
    if not text:
        return 3
    plain = re.sub(r"<[^>]+>", "", text)
    plain = re.sub(r"\s+", "", plain)
    minutes = max(3, round(len(plain) / 600))
    return minutes


H2_PATTERN = re.compile(r"<h2(\s[^>]*)?>(.*?)</h2>", re.DOTALL | re.IGNORECASE)
H2_ID_ATTR = re.compile(r'\bid\s*=\s*"([^"]+)"', re.IGNORECASE)


def build_toc_and_inject_ids(content_html):
    """
    本文HTMLの <h2> を走査して:
      - 各見出しに id="sec-N" を付与（既存idは尊重）
      - 目次HTMLを生成

    h2 が 2 つ未満なら目次は出さない（""を返す）。
    Returns: (toc_html, content_with_ids)
    """
    if not content_html:
        return "", content_html or ""

    matches = list(H2_PATTERN.finditer(content_html))
    if len(matches) < 2:
        return "", content_html

    items = []
    pieces = []
    last_end = 0

    for i, m in enumerate(matches, start=1):
        attrs = m.group(1) or ""
        inner = m.group(2) or ""
        existing = H2_ID_ATTR.search(attrs)
        if existing:
            sec_id = existing.group(1)
            new_h2 = m.group(0)  # idがあるならそのまま
        else:
            sec_id = f"sec-{i}"
            new_h2 = f'<h2{attrs} id="{sec_id}">{inner}</h2>'

        toc_text = re.sub(r"<[^>]+>", "", inner).strip()
        if not toc_text:
            continue

        items.append((sec_id, toc_text))
        pieces.append(content_html[last_end : m.start()])
        pieces.append(new_h2)
        last_end = m.end()

    pieces.append(content_html[last_end:])
    content_with_ids = "".join(pieces)

    if len(items) < 2:
        return "", content_html

    li_html = "".join(
        f'        <li><a href="#{esc(sid)}">{esc(text)}</a></li>\n' for sid, text in items
    )
    toc_html = (
        '      <nav class="bm-col-toc" aria-label="この記事の目次">\n'
        '        <p class="bm-col-toc-label">この記事の目次</p>\n'
        '        <ol class="bm-col-toc-list">\n'
        f'{li_html}'
        '        </ol>\n'
        '      </nav>\n'
    )
    return toc_html, content_with_ids


def build_card(c, readtime):
    slug = make_slug(c)
    thumb = c.get("thumbnail") or f"{SITE}/material/images/og/og-index.webp"
    title_ja = normalize_price_text(c.get("title_ja", ""))
    category = c.get("category") or "その他"
    excerpt = normalize_brand_text(c.get("excerpt_ja", ""))
    date = c.get("date", "")
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


def update_column_html(columns, readtimes):
    """readtimes: generate_details() が本文から計算した {slug: 分}。"""
    p = ROOT / "column.html"
    s = p.read_text(encoding="utf-8")

    # Featured = 最新1件 (日付降順の先頭)。fetch_columns() が空の一覧を拒否する。
    featured = columns[0]
    rest = columns[1:]

    s = replace_grid(
        s, "COLUMN_GRID", "".join(build_card(c, readtimes[make_slug(c)]) for c in rest)
    )

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
            "title": normalize_price_text(featured.get("title_ja", "")),
            "excerpt": normalize_price_text(featured.get("excerpt_ja", "")),
            "thumbnail": featured.get("thumbnail") or f"{SITE}/material/images/og/og-index.webp",
            "category": featured.get("category") or "",
            "date": featured.get("date", ""),
            "readtime": readtimes[make_slug(featured)],
        },
    }
    s = replace_json_script(s, '<script type="application/json" id="bm-column-data">', data_payload)

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
                "name": normalize_price_text(c.get("title_ja") or str(c["id"])),
            }
            for i, c in enumerate(columns, start=1)
        ],
    }
    s = replace_json_script(s, '<script type="application/ld+json" id="column-itemlist-ld">', ld)

    write_text(p, s)
    print(f"Updated {p}")


def build_detail_page(col, detail_data, template):
    slug = make_slug(col)
    title_ja = normalize_price_text(col.get("title_ja") or slug)
    thumb = col.get("thumbnail") or f"{SITE}/material/images/og/og-index.webp"
    category = col.get("category") or ""
    date = col.get("date") or ""
    date_ymd = col.get("date_ymd") or ""
    # WP の post_modified が全記事「今日」になっているケースは信頼しない（QRG的に不自然）
    today_iso = _date.today().isoformat()
    wp_modified = col.get("modified_ymd") or ""
    if wp_modified and wp_modified != today_iso and wp_modified >= date_ymd:
        modified_ymd = wp_modified
    else:
        modified_ymd = date_ymd
    excerpt = normalize_brand_text(col.get("excerpt_ja") or "")
    # WP本文はXSS対策でallowlistサニタイズ＋ブランド方針で正規化（SPEC §15.1 S1）
    content = sanitize_content_html(detail_data.get("content") or "")

    override = DESC_OVERRIDES.get(slug)
    if override:
        description = override[:200]
    else:
        raw_desc = re.sub(r"<[^>]+>", "", excerpt or content).replace("\n", " ").strip()
        description = (raw_desc or f"{title_ja}｜ビズマンガ コラム")[:150]

    cat_html = f'<span class="bm-col-static-cat">{esc(category)}</span>' if category else ""
    hero_html = ""
    if thumb:
        hero_html = (
            f'<figure class="bm-col-static-hero">'
            f'<img src="{esc(thumb)}" alt="{esc(title_ja)}" loading="eager">'
            f'</figure>'
        )

    toc_html, content_with_ids = build_toc_and_inject_ids(content)

    return render_template(
        template,
        text={
            "title_ja": title_ja,
            "description": description,
            "thumbnail": thumb,
            "category": category,
            "date": date,
            "date_ymd": date_ymd,
            "modified_ymd": modified_ymd,
            "url": f"{SITE}/column/{slug}",
        },
        # 組み立て済みのHTML断片（本文はサニタイズ済み）
        html={
            "category_html": cat_html,
            "hero_html": hero_html,
            "toc_html": toc_html,
            "content_html": content_with_ids,
        },
    )


def _fetch_detail_safe(column):
    try:
        return column, fetch_column_detail(column["id"]), None
    except Exception as e:
        return column, None, e


def generate_details(columns):
    """詳細ページを生成し、本文から計算した読了時間 {slug: 分} を返す。"""
    if not TEMPLATE_PATH.exists():
        print(f"ERROR: template not found: {TEMPLATE_PATH}", file=sys.stderr)
        sys.exit(1)
    template = TEMPLATE_PATH.read_text(encoding="utf-8")

    with ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        results = list(executor.map(_fetch_detail_safe, columns))

    failures = [
        str(c["id"])
        for c, detail, err in results
        if err is not None or not isinstance(detail, dict)
    ]
    if failures:
        raise RuntimeError("Column detail fetch failed: " + ", ".join(failures))
    require_records([{"id": make_slug(c)} for c in columns], label="column slugs")
    current_slugs = set()
    readtimes = {}
    written = 0
    for c, detail, _err in results:
        slug = make_slug(c)
        current_slugs.add(slug)
        readtimes[slug] = estimate_readtime(detail.get("content", ""))
        out = build_detail_page(c, detail, template)
        write_text(COLUMN_DIR / f"{slug}.html", out)
        print(f"  Generated column/{slug}.html")
        written += 1

    # column/index.html（/column/ へのリダイレクト）は残す
    removed = prune_stale(COLUMN_DIR, current_slugs | {"index"})

    print(f"Generated {written}/{len(columns)} column pages, removed {removed} stale files")
    return readtimes


def update_sitemap(columns):
    p = ROOT / "sitemap.xml"
    s = p.read_text(encoding="utf-8")

    s = remove_blocks(s, "COLUMNS")

    entries = []
    for c in columns:
        slug = make_slug(c)
        # lastmod はWP側の実更新日のみ使う。ビルド日を書くと「全記事毎日更新」という
        # 嘘のシグナルになり、Googleがsitemapのlastmodを信用しなくなる(2026-06-12)
        modified = c.get("modified_ymd") or c.get("date_ymd") or ""
        entries.append(
            url_entry(
                f"{SITE}/column/{slug}",
                modified,
                frequency="monthly",
                priority="0.6",
            )
        )
    block = build_block("COLUMNS", entries, generator="tools/build-columns.py")
    s = append_blocks(s, block)
    write_text(p, s)
    print(f"Updated {p}")


def _build():
    write_browser_script()
    try:
        columns = fetch_columns()
    except Exception as e:
        print(f"ERROR fetching columns: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Total columns from WP: {len(columns)}")

    # 順序: detail生成 (readtimeを計算) → column.html 更新 → sitemap
    readtimes = generate_details(columns)
    update_column_html(columns, readtimes)
    update_sitemap(columns)
    print("Done.")


def main():
    with output_batch(ROOT):
        return _build()


if __name__ == "__main__":
    main()
