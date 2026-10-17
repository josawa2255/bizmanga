#!/usr/bin/env python3
"""
BizManga コラム静的HTMLビルダー

WP API `/columns` からコラム記事を取得し、以下を自動生成する:
  1. column/{slug}.html 個別ページを生成（SEOフレンドリーURL）
  2. column.html 内の <!-- BUILD:COLUMN_FEATURED --> に特集枠（最新1件）、<!-- BUILD:COLUMN_GRID --> に
     一覧カードを展開（一覧・特集枠はこれが正。ブラウザ側で WP から作り直さず、JS は絞り込みの表示/非表示だけ）
  3. index.html（ホーム）の <!-- BUILD:HOME_COLUMN_GRID --> マーカー間に最新8件のカードを展開
     （ホームの枠もブラウザで WP から取得しない。Issue #79）
  4. sitemap.xml に個別コラムURLを追加
  5. column.html head に ItemList JSON-LD を挿入
  6. 最後に、同じ取得データで RSS（feed.xml）を書く（tools/bm_feed.py。ニュースはそこで取る）。
     フィードの失敗ではページを取り消さない（ページは先に書き終えている）。結果は GitHub Actions の
     ステップ出力 feed=ok / failed に書き、ワークフローが push とデプロイの起動を済ませた後でジョブを失敗にする

使い方:
    cd BizManga
    python3 tools/build-columns.py

実行タイミング（.github/workflows/build-columns.yml）:
    - WordPress でコラムを公開・更新したとき（WP プラグインが workflow_dispatch で起動する）
    - 毎日 03:00 JST の定期実行（取りこぼしの保険）と手動実行
"""

import html
import os
import pathlib
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin
from bm_build import API_BASE, SITE_URL
from bm_build import (
    fetch_json, output_batch, remove_file, render_template,
    replace_block, require_records, script_json, write_text,
)
import bm_content
import bm_feed
from bm_content import make_slug, normalize_brand_text, updated_ymd
from bm_html import _Sanitizer, site_url
from bm_pricing import normalize_price_html, write_browser_script

# WP excerpt が誤っているコラムの description override (再ビルド時の上書き対策)
DESC_OVERRIDES = {
    "business-manga-production-guide": "ビジネスマンガ制作の完全ガイド。企画ヒアリング・シナリオ設計・ネーム・作画・修正・納品の7ステップと、業界相場40,000〜100,000円/ページに対するビズマンガ1ページ25,740円〜（税抜・原稿料別途）の透明料金体系を解説。発注前に読むべき完全マニュアル。",
}


API_SINGLE = API_BASE + '/columns/{id}'
SITE = SITE_URL
ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE_PATH = ROOT / "tools" / "templates" / "column-detail.html.tpl"
COLUMN_DIR = ROOT / "column"

DETAIL_FETCH_WORKERS = 5

# サムネイルが無い・使えない記事の代わりの画像（一覧・特集枠・ホーム枠・詳細ページの og:image で共通）。
# このサイト自身の OG 画像。ContentsX 側（contentsx.jp）の画像に頼らない（BUGS #020）
FALLBACK_THUMB = f"{SITE}/material/images/og/og-index.webp"
# カテゴリ未設定の記事の絞り込み名。カードの data-category・特集枠・チップの件数で同じ値を使う
OTHER_CATEGORY = "その他"

GRID_START = "<!-- BUILD:COLUMN_GRID -->"
GRID_END = "<!-- /BUILD:COLUMN_GRID -->"
FEATURED_START = "<!-- BUILD:COLUMN_FEATURED -->"
FEATURED_END = "<!-- /BUILD:COLUMN_FEATURED -->"

# ホームのコラム枠（index.html #bmColumnGrid）。旧 js/bm-wp-api.js の loadColumns() と同じ件数
HOME_COLUMN_LIMIT = 8
HOME_GRID_START = "<!-- BUILD:HOME_COLUMN_GRID -->"
HOME_GRID_END = "<!-- /BUILD:HOME_COLUMN_GRID -->"

def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def sanitize_content_html(raw):
    """WP本文HTMLをallowlistでサニタイズし、ブランド方針で正規化して返す。"""
    if not raw:
        return ""
    p = _Sanitizer()
    p.feed(raw)
    p.close()
    # 料金文言がstrong等で分かれていても揃える。タグ・URLは変更しない。
    return normalize_brand_text(normalize_price_html("".join(p.out)), prices=False)


def fetch_columns():
    # 全ページを取り切れなければ例外（何も書き出さず、古いページも消さない）。フィードと同じ取得関数
    return bm_content.fetch_columns()


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
        pieces.append(content_html[last_end:m.start()])
        pieces.append(new_h2)
        last_end = m.end()

    pieces.append(content_html[last_end:])
    content_with_ids = "".join(pieces)

    if len(items) < 2:
        return "", content_html

    li_html = "".join(
        f'        <li><a href="#{esc(sid)}">{esc(text)}</a></li>\n'
        for sid, text in items
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


def card_fields(c):
    """一覧カード・特集枠・ホーム枠で共通の表示データ。WP 由来の文字の正規化（料金＋ブランド表現）・
    HTML エスケープ・画像 URL の検査はここだけで行い、返す値はすべてエスケープ済み。"""
    title = normalize_brand_text(c.get("title_ja") or "")
    return {
        # 詳細ページは make_slug の名前で生成するので、リンクは常に /column/{slug}（/ 始まり、BUGS #006）
        "href": esc(f"/column/{make_slug(c)}"),
        "src": esc(site_url(c.get("thumbnail")) or FALLBACK_THUMB),
        "title": esc(title),
        "excerpt": esc(normalize_brand_text(c.get("excerpt_ja") or "")),
        "category": esc(c.get("category") or ""),
        "filter": esc(c.get("category") or OTHER_CATEGORY),
        "date": esc(c.get("date") or ""),
        "readtime": esc(c.get("_readtime", 5)),
    }


def build_card(c, *, indent=6, featured=False, home=False):
    """コラムのカード1枚（一覧 column.html とホーム index.html の枠で共通）。
    - home=False（一覧）: data-category（絞り込み用）と読了時間つき
    - home=True（ホームの枠）: 旧 js/bm-wp-api.js の loadColumns() と同じ構造（読了時間・data-category 無し）
    - featured=True: 特集枠と同じ記事のカード（bm-column-card--featured）。PC は特集枠があるので CSS で隠し、
      特集枠を隠すスマホ（〜768px）でだけ一覧の先頭に見せる
    indent はマーカーの位置に合わせた字下げ（出力の見た目だけ）。"""
    f = card_fields(c)
    card_class = "bm-column-card bm-column-card--featured" if featured else "bm-column-card"
    category_attr = "" if home else f' data-category="{f["filter"]}"'
    date = f'<time class="bm-column-card-date">{f["date"]}</time>'
    rows = [
        f'<a class="{card_class}" href="{f["href"]}"{category_attr}>',
        f'  <div class="bm-column-card-img"><img src="{f["src"]}" alt="{f["title"]}" loading="lazy" width="400" height="225"></div>',
        '  <div class="bm-column-card-body">',
        *([f'    <span class="bm-column-card-cat">{f["category"]}</span>'] if f["category"] else []),
        f'    <h3 class="bm-column-card-title">{f["title"]}</h3>',
        f'    <p class="bm-column-card-excerpt">{f["excerpt"]}</p>',
        *(['    ' + date] if home else [
            '    <div class="bm-column-card-meta">',
            f'      <span class="bm-column-card-readtime">{f["readtime"]}分</span>',
            '      ' + date,
            '    </div>',
        ]),
        '  </div>',
        '</a>',
    ]
    return "".join(" " * indent + row + "\n" for row in rows)


def build_featured(c):
    """column.html の特集枠（#bmColumnFeatured の中身）。PC で最新記事を大きく見せる。
    文字・URL は一覧カードと同じ card_fields を通すので、PC の特集枠とスマホの先頭カードは同じ文になる。"""
    f = card_fields(c)
    rows = [
        f'<a class="bm-column-featured-card" id="bmColumnFeaturedCard" href="{f["href"]}" data-category="{f["filter"]}">',
        '  <div class="bm-column-featured-img">',
        # サムネイルは 16:9（一覧カードと同じ画像）。枠の 21:9 は CSS の object-fit: cover で切り抜く
        f'    <img src="{f["src"]}" alt="{f["title"]}" loading="eager" width="1200" height="675">',
        '  </div>',
        '  <div class="bm-column-featured-body">',
        '    <p class="bm-column-featured-label">',
        '      <span>特集記事</span>',
        f'      <time class="bm-column-featured-date">{f["date"]}</time>',
        '    </p>',
        *([f'    <span class="bm-column-featured-cat">{f["category"]}</span>'] if f["category"] else []),
        f'    <h2 class="bm-column-featured-title">{f["title"]}</h2>',
        f'    <p class="bm-column-featured-excerpt">{f["excerpt"]}</p>',
        '    <span class="bm-column-featured-read">記事を読む →</span>',
        '  </div>',
        '</a>',
    ]
    return "".join("      " + row + "\n" for row in rows)


def category_counts(columns):
    """絞り込みチップのカテゴリと件数（件数の多い順、その他は末尾）。カードの data-category と同じ名前"""
    counts = {}
    for c in columns:
        name = c.get("category") or OTHER_CATEGORY
        counts[name] = counts.get(name, 0) + 1
    return sorted(
        [{"name": k, "count": v} for k, v in counts.items()],
        key=lambda x: (x["name"] == OTHER_CATEGORY, -x["count"]),
    )


def update_column_html(columns):
    p = ROOT / "column.html"
    s = p.read_text(encoding="utf-8")

    # 特集 = 最新1件（WP の並び＝公開日の新しい順の先頭）。PC は特集枠、スマホは一覧の先頭カードで見せる
    s, _ = replace_block(s, FEATURED_START, FEATURED_END,
                         f"{FEATURED_START}\n{build_featured(columns[0])}      {FEATURED_END}", required=True)
    # 一覧はこの静的カードが正（ブラウザ側で WP から作り直さない。Issue #74）
    cards = "".join(build_card(c, featured=i == 0) for i, c in enumerate(columns))
    s, _ = replace_block(s, GRID_START, GRID_END, f"{GRID_START}\n{cards}      {GRID_END}", required=True)

    # 絞り込みチップのカテゴリと件数（bm-column-filter.js が読む）
    data_payload = {"total": len(columns), "categories": category_counts(columns)}
    data_tag = (
        '<script type="application/json" id="bm-column-data">\n'
        + script_json(data_payload, indent=2)
        + "\n</script>"
    )
    s, _ = replace_block(s, '<script type="application/json" id="bm-column-data">', "</script>", data_tag, required=True)

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
                "name": normalize_brand_text(c.get("title_ja") or str(c["id"])),
            }
            for i, c in enumerate(columns, start=1)
        ],
    }
    ld_tag = (
        '<script type="application/ld+json" id="column-itemlist-ld">\n'
        + script_json(ld, indent=2)
        + "\n</script>"
    )
    s, _ = replace_block(s, '<script type="application/ld+json" id="column-itemlist-ld">', "</script>", ld_tag, required=True)

    write_text(p, s)
    print(f"Updated {p}")


def update_home_html(columns):
    """index.html のコラム枠（#bmColumnGrid）に、WP の一覧と同じ並びの先頭8件を書き込む。
    マーカーが無ければ column.html と同じくビルド失敗にする（出力は1つも反映されない）。"""
    p = ROOT / "index.html"
    s = p.read_text(encoding="utf-8")
    cards = "".join(build_card(c, indent=10, home=True) for c in columns[:HOME_COLUMN_LIMIT])
    block = f"{HOME_GRID_START}\n{cards}          {HOME_GRID_END}"
    s, _ = replace_block(s, HOME_GRID_START, HOME_GRID_END, block, required=True)
    write_text(p, s)
    print(f"Updated {p}")


def build_detail_page(col, detail_data, template):
    slug = make_slug(col)
    title_ja = normalize_brand_text(col.get("title_ja") or slug)
    # ヒーロー画像・og:image・JSON-LD の image。一覧カードと同じ検査を通し、og:image 用に絶対URLにする
    thumb = urljoin(SITE + "/", site_url(col.get("thumbnail")) or FALLBACK_THUMB)
    category = col.get("category") or ""
    date = col.get("date") or ""
    date_ymd = col.get("date_ymd") or ""
    # dateModified は sitemap の lastmod・フィードと同じ関数（公開日と更新日の新しい方。実行時刻に依存しない）
    modified_ymd = updated_ymd(col)
    excerpt = normalize_brand_text(col.get("excerpt_ja") or "")
    # WP本文はXSS対策でallowlistサニタイズ＋ブランド方針で正規化（SPEC §15.1 S1）
    content = sanitize_content_html(detail_data.get("content") or "")

    override = DESC_OVERRIDES.get(slug)
    if override:
        description = override[:200]
    else:
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

    toc_html, content_with_ids = build_toc_and_inject_ids(content)

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
        "{{toc_html}}": toc_html,
        "{{content_html}}": content_with_ids,
    }

    return render_template(template, replacements)


def _fetch_detail_safe(column):
    try:
        return column, fetch_column_detail(column["id"]), None
    except Exception as e:
        return column, None, e


def generate_details(columns):
    if not TEMPLATE_PATH.exists():
        print(f"ERROR: template not found: {TEMPLATE_PATH}", file=sys.stderr)
        sys.exit(1)
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    COLUMN_DIR.mkdir(exist_ok=True)

    with ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        results = list(executor.map(_fetch_detail_safe, columns))

    failures = [str(c["id"]) for c, detail, err in results if err is not None or not isinstance(detail, dict)]
    if failures:
        raise RuntimeError("Column detail fetch failed: " + ", ".join(failures))
    require_records([{"id": make_slug(c)} for c in columns], label="column slugs")
    current_slugs = set()
    written = 0
    for c, detail, err in results:
        slug = make_slug(c)
        current_slugs.add(slug)
        c["_readtime"] = estimate_readtime(detail.get("content", ""))
        out = build_detail_page(c, detail, template)
        write_text(COLUMN_DIR / f"{slug}.html", out)
        print(f"  Generated column/{slug}.html")
        written += 1

    removed = 0
    for existing in COLUMN_DIR.glob("*.html"):
        if existing.stem == "index":
            continue
        if existing.stem not in current_slugs:
            remove_file(existing)
            removed += 1

    print(f"Generated {written}/{len(columns)} column pages, removed {removed} stale files")


def update_sitemap(columns):
    p = ROOT / "sitemap.xml"
    s = p.read_text(encoding="utf-8")

    pattern = re.compile(
        r"\s*<!-- BUILD:COLUMNS[^>]*?-->[\s\S]*?<!-- /BUILD:COLUMNS -->\s*"
    )
    s = pattern.sub("\n\n", s)

    entries = []
    for c in columns:
        slug = make_slug(c)
        # lastmod はWP側の実更新日のみ使う。ビルド日を書くと「全記事毎日更新」という
        # 嘘のシグナルになり、Googleがsitemapのlastmodを信用しなくなる(2026-06-12)。
        # 詳細ページの dateModified・フィードと同じ関数（予約投稿でも公開日より前にならない）
        modified = updated_ymd(c)
        lastmod_line = f"    <lastmod>{modified}</lastmod>\n" if modified else ""
        entries.append(
            "  <url>\n"
            f"    <loc>{SITE}/column/{slug}</loc>\n"
            f"{lastmod_line}"
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
    write_text(p, s)
    print(f"Updated {p}")


def _build():
    write_browser_script()
    try:
        columns = fetch_columns()
    except Exception as e:
        print(f"ERROR fetching columns: {e}", file=sys.stderr)
        sys.exit(1)

    # 0件は fetch_columns() が拒否する（既存ページを消さないため）
    print(f"Total columns from WP: {len(columns)}")

    # 順序: detail生成 (readtimeを記録) → column.html 更新 → ホームの枠 → sitemap
    generate_details(columns)
    update_column_html(columns)
    update_home_html(columns)
    update_sitemap(columns)
    print("Done.")
    return columns


def write_feed(columns):
    """ページと同じ取得データ（columns）で feed.xml を書く。成功なら True。
    失敗してもページは取り消さない（書き終えている）。Actions の画面にエラーを出して False を返す。"""
    try:
        with output_batch(ROOT):
            count = bm_feed.write_feed(columns, ROOT)
    except Exception as e:
        print(f"::error::feed.xml was not updated (the column pages were): {e}", file=sys.stderr)
        return False
    print(f"Updated feed.xml ({count} items)")
    return True


def step_output(**values):
    """GitHub Actions のステップ出力（steps.<id>.outputs.*）。Actions の外では何もしない"""
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as output:
            output.writelines(f"{key}={value}\n" for key, value in values.items())


def main():
    with output_batch(ROOT):
        columns = _build()
    step_output(feed="ok" if write_feed(columns) else "failed")


if __name__ == "__main__":
    main()
