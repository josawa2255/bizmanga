#!/usr/bin/env python3
"""
BizManga 制作事例の静的HTMLビルダー

WP API `/works` から制作事例を取得し、以下を自動生成する:
  1. works.html 内の <!-- BUILD:WORKS_GRID --> マーカー間に静的カードを展開
  2. works/{slug}.html 個別ページを生成（テンプレから）
  3. sitemap.xml に個別作品URLを追加
  4. works.html head に ItemList JSON-LD を挿入

使い方:
    cd BizManga
    python3 tools/build-works.py

実行タイミング:
    - WordPress で works を追加・更新した後
    - 週1回の定期実行（GitHub Actions）

Why:
    現状 works.html は JS で WP API から描画する構成のため、
    Googlebot の JS レンダリング前は空ページ扱い、AI クローラーは読めない。
    本スクリプトは事前に静的HTMLを生成して SEO/AI 可読性を担保する。
"""

import html
import json
import pathlib
import re
import sys
import urllib.request

API = "https://cms.contentsx.jp/wp-json/contentsx/v1/works"
SITE = "https://bizmanga.contentsx.jp"
ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE_PATH = ROOT / "tools" / "templates" / "work-detail.html.tpl"
WORKS_DIR = ROOT / "works"


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def fetch_works():
    req = urllib.request.Request(API, headers={"User-Agent": "BizManga-Builder/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode("utf-8"))
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected API response: {type(data)}")
    return data


def filter_for_bm(works):
    # show_site: "both" のみ（BizManga で表示される作品）
    return [w for w in works if w.get("show_site") == "both"]


def build_card(w):
    slug = w["id"]
    thumb = w.get("thumbnail") or (w.get("gallery") or [""])[0]
    title_ja = w.get("title_ja", "")
    category = w.get("category", "")
    media = " / ".join(w.get("media") or [])
    point = w.get("point", "")
    detail_url = f"/works/{slug}"
    desc_html = f'<p class="bm-works-card-desc">{esc(point)}</p>' if point else ""
    meta_html = (
        f'<div class="bm-works-card-meta"><span class="bm-works-card-media">{esc(media)}</span></div>'
        if media else ""
    )
    cat_html = f'<span class="bm-works-card-category">{esc(category)}</span>' if category else ""
    return (
        f'      <article class="bm-works-card" data-work-id="{esc(slug)}" data-build-static="1">\n'
        f'        <a href="{esc(detail_url)}" class="bm-works-card-link">\n'
        f'          <div class="bm-works-card-thumb">\n'
        f'            <img src="{esc(thumb)}" alt="{esc(title_ja)}" loading="lazy" width="400" height="560">\n'
        f'          </div>\n'
        f'          <div class="bm-works-card-body">\n'
        f'            {cat_html}\n'
        f'            <h3 class="bm-works-card-title">{esc(title_ja)}</h3>\n'
        f'            {desc_html}\n'
        f'            {meta_html}\n'
        f'          </div>\n'
        f'        </a>\n'
        f'      </article>\n'
    )


def update_works_html(works):
    p = ROOT / "works.html"
    s = p.read_text(encoding="utf-8")

    cards = "".join(build_card(w) for w in works)
    start = "<!-- BUILD:WORKS_GRID -->"
    end = "<!-- /BUILD:WORKS_GRID -->"
    block = f"{start}\n{cards}      {end}"
    pattern = re.compile(re.escape(start) + r"[\s\S]*?" + re.escape(end))
    if pattern.search(s):
        s = pattern.sub(block, s)
    else:
        # Inject inside #bmWorksGrid
        s = s.replace(
            '<div class="bm-works-grid" id="bmWorksGrid">',
            f'<div class="bm-works-grid" id="bmWorksGrid">\n      {block}',
            1,
        )

    # ItemList JSON-LD
    ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "BizManga 制作事例一覧",
        "numberOfItems": len(works),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i,
                "url": f"{SITE}/works/{w['id']}",
                "name": w.get("title_ja") or w["id"],
            }
            for i, w in enumerate(works, start=1)
        ],
    }
    ld_tag = (
        '<script type="application/ld+json" id="works-itemlist-ld">\n'
        + json.dumps(ld, ensure_ascii=False, indent=2)
        + "\n</script>"
    )
    ld_pattern = re.compile(
        r'<script type="application/ld\+json" id="works-itemlist-ld">[\s\S]*?</script>'
    )
    if ld_pattern.search(s):
        s = ld_pattern.sub(ld_tag, s)
    else:
        s = s.replace("</head>", f"  {ld_tag}\n</head>", 1)

    p.write_text(s, encoding="utf-8")
    print(f"Updated {p}")


def build_detail_page(w, template):
    slug = w["id"]
    title_ja = w.get("title_ja") or slug
    title_en = w.get("title_en") or title_ja
    thumb = w.get("thumbnail") or (w.get("gallery") or [""])[0]
    category = w.get("category") or "制作事例"
    pages_count = (w.get("spec") or {}).get("pages") or (
        f"{w.get('pages')}P" if w.get("pages") else "—"
    )
    period = (w.get("spec") or {}).get("period") or "—"
    point = w.get("point") or f"{title_ja}の制作事例です。"
    comment = w.get("comment") or "—"
    client = w.get("client") or ""
    client_line = f"クライアント: {client}" if client else "ビジネスマンガ制作事例"
    media = " / ".join(w.get("media") or []) or "—"
    gallery = w.get("gallery") or []

    gallery_html = "\n".join(
        f'          <img src="{esc(g)}" alt="{esc(title_ja)} ページ{i+1}" loading="lazy">'
        for i, g in enumerate(gallery)
    ) or '          <p style="color:#999;">ギャラリー画像はありません。</p>'

    # Description: point の先頭 150 文字 or タイトル
    raw_desc = re.sub(r"<[^>]+>", "", point).replace("\n", " ").strip()
    description = (raw_desc or f"{title_ja}｜ビジネスマンガ制作事例")[:150]

    # 1200x630 専用OG画像 (tools/build-works-og.py で生成)。無ければ WP thumb にフォールバック。
    og_image_path = ROOT / "material" / "images" / "og" / "works" / f"{slug}.webp"
    if og_image_path.exists():
        og_image = f"{SITE}/material/images/og/works/{slug}.webp"
    else:
        og_image = thumb or f"{SITE}/material/images/og/og-index.webp"

    replacements = {
        "{{slug}}": esc(slug),
        "{{title_ja}}": esc(title_ja),
        "{{title_en}}": esc(title_en),
        "{{description}}": esc(description),
        "{{thumbnail}}": esc(thumb),
        "{{og_image}}": esc(og_image),
        "{{category}}": esc(category),
        "{{pages_count}}": esc(pages_count),
        "{{period}}": esc(period),
        "{{point}}": esc(point),
        "{{comment}}": esc(comment),
        "{{client}}": esc(client),
        "{{client_line}}": esc(client_line),
        "{{media}}": esc(media),
        "{{url}}": f"{SITE}/works/{slug}",
        # gallery_html は既にエスケープ済みなのでそのまま
        "{{gallery_html}}": gallery_html,
    }

    out = template
    for k, v in replacements.items():
        out = out.replace(k, v)
    return out


def generate_details(works):
    if not TEMPLATE_PATH.exists():
        print(f"ERROR: template not found: {TEMPLATE_PATH}", file=sys.stderr)
        sys.exit(1)
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    WORKS_DIR.mkdir(exist_ok=True)

    # 既存ファイルをクリーンアップ（今回取得しなかった作品のファイルを削除）
    current_slugs = {w["id"] for w in works}
    removed = 0
    for existing in WORKS_DIR.glob("*.html"):
        if existing.stem not in current_slugs:
            existing.unlink()
            removed += 1

    for w in works:
        out = build_detail_page(w, template)
        (WORKS_DIR / f"{w['id']}.html").write_text(out, encoding="utf-8")
    print(f"Generated {len(works)} detail pages, removed {removed} stale files")


def update_sitemap(works):
    p = ROOT / "sitemap.xml"
    s = p.read_text(encoding="utf-8")

    # Remove existing BUILD:WORKS block(s). コメント内の「(auto-generated…)」等の
    # 追加テキストや重複ブロックにも対応するため、開始タグは柔軟にマッチさせる。
    pattern = re.compile(
        r"\s*<!-- BUILD:WORKS[^>]*?-->[\s\S]*?<!-- /BUILD:WORKS -->\s*"
    )
    s = pattern.sub("\n\n", s)

    entries = []
    for w in works:
        entries.append(
            "  <url>\n"
            f"    <loc>{SITE}/works/{w['id']}</loc>\n"
            "    <changefreq>monthly</changefreq>\n"
            "    <priority>0.6</priority>\n"
            "  </url>"
        )
    block = (
        "  <!-- BUILD:WORKS (auto-generated by tools/build-works.py) -->\n"
        + "\n".join(entries)
        + "\n  <!-- /BUILD:WORKS -->\n"
    )
    s = s.replace("</urlset>", block + "\n</urlset>")
    p.write_text(s, encoding="utf-8")
    print(f"Updated {p}")


def main():
    try:
        all_works = fetch_works()
    except Exception as e:
        print(f"ERROR fetching works: {e}", file=sys.stderr)
        sys.exit(1)

    bm_works = filter_for_bm(all_works)
    print(f"Total works from WP: {len(all_works)}")
    print(f"BizManga works (show_site='both'): {len(bm_works)}")

    update_works_html(bm_works)
    generate_details(bm_works)
    update_sitemap(bm_works)

    print("Done.")


if __name__ == "__main__":
    main()
