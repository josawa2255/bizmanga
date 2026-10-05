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
    - 日次の定期実行（GitHub Actions）

Why:
    現状 works.html は JS で WP API から描画する構成のため、
    Googlebot の JS レンダリング前は空ページ扱い、AI クローラーは読めない。
    本スクリプトは事前に静的HTMLを生成して SEO/AI 可読性を担保する。
"""

import json
import pathlib
import re
from datetime import date
import sys
from bm_work_content import (
    CATEGORY_USECASE,
    CATEGORY_TITLE_KW,
    CATEGORY_LP_LINK,
    CATEGORY_PAGES,
)
from bm_sitemap import append_blocks, build_block, remove_blocks, url_entry
from bm_build import API_BASE, SITE_URL
from bm_build import (
    escape_html as esc,
    fetch_json as _fetch_json,
    output_batch,
    remove_file,
    render_template,
    replace_block,
    require_records,
    safe_slug,
    script_json,
    write_text,
)

API = API_BASE + '/works'
SITE = SITE_URL
ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE_PATH = ROOT / "tools" / "templates" / "work-detail.html.tpl"
CATEGORY_TEMPLATE_PATH = ROOT / "tools" / "templates" / "works-category.html.tpl"
WORKS_DIR = ROOT / "works"
CATEGORY_DIR = ROOT / "works" / "category"

# 詳細ページ「ページ一覧」で表示する漫画ページ数の上限（抜粋プレビュー）。
# 全ページは /biz-library の漫画ビューアで閲覧する想定。
MAX_GALLERY_PAGES = 4


def fetch_works():
    works = require_records(_fetch_json(API, timeout=20), label="works")
    for work in works:
        safe_slug(work["id"])
    return works


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
        if media
        else ""
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
    s, _ = replace_block(s, start, end, block, required=True)

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
        + script_json(ld, indent=2)
        + "\n</script>"
    )
    s, _ = replace_block(
        s,
        '<script type="application/ld+json" id="works-itemlist-ld">',
        "</script>",
        ld_tag,
        required=True,
    )

    write_text(p, s)
    print(f"Updated {p}")


def build_detail_page(w, template, all_works=()):
    slug = w["id"]
    title_ja = w.get("title_ja") or slug
    # ヒーロー表示用は gallery[0] のフル解像度を優先 (WP thumbnail は 188x300 の小さなサムネで、
    # 1200x630 として引き延ばすと画質劣化 + LCP要素として機能しないため)。
    # fallback として従来の thumbnail → gallery[0] 順で参照。
    gallery_list = w.get("gallery") or []
    hero_src = gallery_list[0] if gallery_list else (w.get("thumbnail") or "")
    thumb = hero_src  # 後方互換で thumb 変数名も維持
    category = w.get("category") or "制作事例"
    # title に入れる検索KW（未定義カテゴリは「ビジネス漫画」にフォールバック）
    category_kw = CATEGORY_TITLE_KW.get(category, "ビジネス漫画")
    # 作品名自体がKWを含む場合（例: 作品名「採用漫画」）は
    # 「採用漫画｜採用漫画の制作事例」と重複するため、業種等の補足に置き換える
    if category_kw in title_ja:
        category_kw = "ビジネス漫画"
    # gallery実枚数があればWP手入力(spec.pages/pages)より優先する
    # (BUGS #049/#050と同種。手入力ミスでズレるとスペック表記だけ古いまま残るため)
    gallery_len_for_spec = len(gallery_list)
    if gallery_len_for_spec > 0:
        pages_count = f"{gallery_len_for_spec}P"
    else:
        pages_count = (w.get("spec") or {}).get("pages") or (
            f"{w.get('pages')}P" if w.get("pages") else "—"
        )
    period = (w.get("spec") or {}).get("period") or "—"
    point = w.get("point") or f"{title_ja}の制作事例です。"
    # コメントが空・ダッシュのみの場合は「お客様コメント」セクション自体を非表示
    # (空セクションはSEO減点・UX劣化。WP側に記入されたらセクション復活)
    comment_raw = (w.get("comment") or "").strip()
    if comment_raw and comment_raw not in ("—", "-"):
        comment_section = (
            '      <section class="bm-work-detail-section">\n'
            '        <h2>お客様コメント</h2>\n'
            f'        <p>{esc(comment_raw)}</p>\n'
            '      </section>'
        )
    else:
        comment_section = ''
    client = w.get("client") or ""
    client_line = f"クライアント: {client}" if client else "ビジネスマンガ制作事例"
    media = " / ".join(w.get("media") or []) or "—"
    gallery = w.get("gallery") or []

    gallery_html = (
        "\n".join(
            f'          <img src="{esc(g)}" alt="{esc(title_ja)} ページ{i + 1}" loading="lazy" decoding="async">'
            for i, g in enumerate(gallery[:MAX_GALLERY_PAGES])
        )
        or '          <p style="color:#999;">ギャラリー画像はありません。</p>'
    )

    # Description: point の先頭 150 文字 or タイトル
    raw_desc = re.sub(r"<[^>]+>", "", point).replace("\n", " ").strip()
    description = (raw_desc or f"{title_ja}｜ビジネスマンガ制作事例")[:150]

    # 1200x630 専用OG画像 (tools/build-works-og.py で生成)。無ければ WP thumb にフォールバック。
    og_image_path = ROOT / "material" / "images" / "og" / "works" / f"{slug}.webp"
    if og_image_path.exists():
        og_image = f"{SITE}/material/images/og/works/{slug}.webp"
    else:
        og_image = thumb or f"{SITE}/material/images/og/og-index.webp"

    # === 「この事例について」セクション: クライアント・媒体・期間を文章化 ===
    media_list = w.get("media") or []
    media_phrase = "・".join(media_list[:5]) if media_list else "Web・印刷物"
    pages_num = w.get("pages") or "—"
    if client:
        about_body = (
            f"本作品は{esc(client)}様向けに制作した{esc(category)}マンガです。"
            f"全{esc(pages_num)}ページ構成で、約{esc(period)}の制作期間を経て納品しました。"
            f"納品後は{esc(media_phrase)}など複数媒体で展開いただき、ターゲット読者への訴求力強化に貢献しています。"
        )
    else:
        about_body = (
            f"本作品は{esc(category)}用途で制作したビジネスマンガ事例です。"
            f"全{esc(pages_num)}ページ構成・約{esc(period)}の制作期間で完成させ、"
            f"{esc(media_phrase)}など複数媒体での展開を想定した設計になっています。"
        )
    about_section = (
        '      <section class="bm-work-detail-section">\n'
        '        <h2>この事例について</h2>\n'
        f'        <p>{about_body}</p>\n'
        '      </section>'
    )

    # === 「この用途の活用シーン」セクション: カテゴリ別の汎用解説 ===
    usecase_text = CATEGORY_USECASE.get(category, "")
    if usecase_text:
        usecase_section = (
            '      <section class="bm-work-detail-section">\n'
            f'        <h2>{esc(category)}マンガの活用シーン</h2>\n'
            f'        <p>{esc(usecase_text)}</p>\n'
            '      </section>'
        )
    else:
        usecase_section = ''

    # === 関連事例セクション ===
    # 同カテゴリの他作品から最大3件選定（self除く）
    related_works = [
        rw
        for rw in all_works
        if rw.get("category") == category and rw.get("id") != slug and rw.get("show_site") == "both"
    ][:3]
    if related_works:
        related_cards = []
        for rw in related_works:
            r_thumb = rw.get("thumbnail") or (rw.get("gallery") or [""])[0]
            related_cards.append(
                f'          <a class="bm-work-related-card" href="/works/{esc(rw["id"])}">\n'
                f'            <img src="{esc(r_thumb)}" alt="{esc(rw.get("title_ja", ""))}" loading="lazy" width="200" height="280">\n'
                f'            <span class="bm-work-related-name">{esc(rw.get("title_ja", ""))}</span>\n'
                f'          </a>'
            )
        related_section = (
            '      <section class="bm-work-detail-section">\n'
            f'        <h2>{esc(category)}の関連事例</h2>\n'
            '        <div class="bm-work-related-grid">\n' + "\n".join(related_cards) + "\n"
            '        </div>\n'
            '      </section>'
        )
    else:
        related_section = ''

    # === CTA リード ===
    cta_lead = f"{esc(category)}マンガの制作実績を持つビズマンガなら、お客様の課題に合わせたオリジナルストーリーをご提案できます。"
    lp_path, lp_label = CATEGORY_LP_LINK.get(category, ("/works", "制作事例一覧"))
    cta_lp_link = f'<a href="{lp_path}">{esc(lp_label)}</a>'

    replacements = {
        "{{slug}}": esc(slug),
        "{{title_ja}}": esc(title_ja),
        "{{category_kw}}": esc(category_kw),
        "{{description}}": esc(description),
        "{{thumbnail}}": esc(thumb),
        "{{og_image}}": esc(og_image),
        "{{category}}": esc(category),
        "{{pages_count}}": esc(pages_count),
        "{{period}}": esc(period),
        "{{point}}": esc(point),
        "{{comment_section}}": comment_section,
        "{{about_section}}": about_section,
        "{{usecase_section}}": usecase_section,
        "{{related_section}}": related_section,
        "{{cta_lead}}": cta_lead,
        "{{cta_lp_link}}": cta_lp_link,
        "{{client}}": esc(client),
        "{{client_line}}": esc(client_line),
        "{{media}}": esc(media),
        "{{url}}": f"{SITE}/works/{slug}",
        # gallery_html は既にエスケープ済みなのでそのまま
        "{{gallery_html}}": gallery_html,
    }

    return render_template(template, replacements)


def build_category_card(w):
    """カテゴリページ用のカードHTML（works.html のカードと同形式）"""
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
        if media
        else ""
    )
    cat_html = f'<span class="bm-works-card-category">{esc(category)}</span>' if category else ""
    return (
        f'          <article class="bm-works-card" data-work-id="{esc(slug)}">\n'
        f'            <a href="{esc(detail_url)}" class="bm-works-card-link">\n'
        f'              <div class="bm-works-card-thumb">\n'
        f'                <img src="{esc(thumb)}" alt="{esc(title_ja)}" loading="lazy" width="400" height="560">\n'
        f'              </div>\n'
        f'              <div class="bm-works-card-body">\n'
        f'                {cat_html}\n'
        f'                <h3 class="bm-works-card-title">{esc(title_ja)}</h3>\n'
        f'                {desc_html}\n'
        f'                {meta_html}\n'
        f'              </div>\n'
        f'            </a>\n'
        f'          </article>\n'
    )


def build_category_works_json(works):
    """カテゴリページのモーダル用に作品データを JSON で埋め込む。

    Why: カテゴリページは静的SEOページで WP API を読み込んでいないため、
    カードクリック直後にモーダルを開くにはビルド時のデータ同梱が必要。
    js/bm-work-modal.js が #bmWorksModalData から読む。
    モーダルのプレビューは最大5ページなので gallery も5枚までに絞る。
    """
    payload = []
    for w in works:
        spec = w.get("spec") or {}
        payload.append(
            {
                "id": w.get("id"),
                "title_ja": w.get("title_ja") or "",
                "category": w.get("category") or "",
                "media": w.get("media") or [],
                "spec": {
                    "pages": spec.get("pages") or "",
                    "period": spec.get("period") or "",
                },
                "point": w.get("point") or "",
                "comment": w.get("comment") or "",
                "pages": w.get("pages") or 0,
                "view_type": w.get("view_type") or "",
                "gallery": (w.get("gallery") or [])[:5],
            }
        )
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    # <script> 内に埋め込むため "<" を全てエスケープ（"</script>" 混入防止）
    return raw.replace("<", "\\u003c")


def build_cat_nav(active_slug, works):
    """カテゴリページ間ナビ。各カテゴリの該当件数も表示。"""
    items = []
    # 「すべて」リンク（works トップへ）
    total = len(works)
    items.append(
        f'        <a class="bm-cat-nav-link" href="/works">'
        f'すべて<span class="bm-cat-nav-link-count">（{total}）</span></a>'
    )
    for slug, cfg in CATEGORY_PAGES.items():
        count = len([w for w in works if w.get("category") in cfg["data_categories"]])
        if count == 0:
            continue
        is_active = slug == active_slug
        active_attr = ' aria-current="page"' if is_active else ''
        items.append(
            f'        <a class="bm-cat-nav-link" href="/works/category/{slug}"{active_attr}>'
            f'{esc(cfg["kw_short"])}<span class="bm-cat-nav-link-count">（{count}）</span></a>'
        )
    return "\n".join(items)


def build_faq_html(faq_items):
    blocks = []
    for item in faq_items:
        blocks.append(
            f'          <div class="bm-cat-faq-item">\n'
            f'            <h3 class="bm-cat-faq-q">{esc(item["q"])}</h3>\n'
            f'            <p class="bm-cat-faq-a">{esc(item["a"])}</p>\n'
            f'          </div>'
        )
    return "\n".join(blocks)


def build_faq_jsonld(faq_items):
    return script_json(
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": item["q"],
                    "acceptedAnswer": {"@type": "Answer", "text": item["a"]},
                }
                for item in faq_items
            ],
        },
        indent=2,
    )


def build_breadcrumb_jsonld(slug, kw):
    return script_json(
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "ホーム", "item": f"{SITE}/"},
                {"@type": "ListItem", "position": 2, "name": "制作事例", "item": f"{SITE}/works"},
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": kw,
                    "item": f"{SITE}/works/category/{slug}",
                },
            ],
        },
        indent=2,
    )


def build_itemlist_jsonld(slug, cfg, matched):
    return script_json(
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "@id": f"{SITE}/works/category/{slug}",
            "name": f"「{cfg['kw_short']}」のマンガ制作事例",
            "description": cfg["description"],
            "url": f"{SITE}/works/category/{slug}",
            "isPartOf": {"@id": f"{SITE}/works"},
            "mainEntity": {
                "@type": "ItemList",
                "name": f"{cfg['kw_short']}制作事例",
                "numberOfItems": len(matched),
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": i,
                        "url": f"{SITE}/works/{w['id']}",
                        "name": w.get("title_ja") or w["id"],
                    }
                    for i, w in enumerate(matched, start=1)
                ],
            },
        },
        indent=2,
    )


def generate_category_pages(works):
    """カテゴリページを /works/category/{slug}.html に生成"""
    if not CATEGORY_TEMPLATE_PATH.exists():
        raise FileNotFoundError(CATEGORY_TEMPLATE_PATH)
    template = CATEGORY_TEMPLATE_PATH.read_text(encoding="utf-8")
    CATEGORY_DIR.mkdir(parents=True, exist_ok=True)

    # 既存カテゴリHTMLをクリーンアップ
    valid_slugs = set(CATEGORY_PAGES.keys())
    removed = 0
    for existing in CATEGORY_DIR.glob("*.html"):
        if existing.stem not in valid_slugs:
            remove_file(existing)
            removed += 1

    generated = 0
    skipped = 0
    for slug, cfg in CATEGORY_PAGES.items():
        matched = [w for w in works if w.get("category") in cfg["data_categories"]]
        if not matched:
            # 該当作品が0件のカテゴリは生成しない（thin content 回避）
            # ただし既存ファイルがあれば削除する
            stale = CATEGORY_DIR / f"{slug}.html"
            if stale.exists():
                remove_file(stale)
                removed += 1
            skipped += 1
            continue

        cards_html = "".join(build_category_card(w) for w in matched)
        cat_nav_html = build_cat_nav(slug, works)
        faq_html = build_faq_html(cfg["faq"])
        faq_jsonld = build_faq_jsonld(cfg["faq"])
        breadcrumb_jsonld = build_breadcrumb_jsonld(slug, cfg["kw"])
        itemlist_jsonld = build_itemlist_jsonld(slug, cfg, matched)
        usecase_text = ""
        for cat in cfg["data_categories"]:
            t = CATEGORY_USECASE.get(cat)
            if t:
                usecase_text = t
                break
        # OG画像: works トップの og-works.webp を再利用（1200x630 既存）
        og_image = f"{SITE}/material/images/og/og-works.webp"

        replacements = {
            "{{slug}}": esc(slug),
            "{{kw}}": esc(cfg["kw"]),
            "{{kw_short}}": esc(cfg["kw_short"]),
            "{{title_seo}}": esc(cfg["title_seo"]),
            "{{description}}": esc(cfg["description"]),
            "{{keywords}}": esc(cfg["keywords"]),
            "{{intro_lead}}": esc(cfg["intro_lead"]),
            "{{usecase_text}}": esc(usecase_text or cfg["intro_lead"]),
            "{{count}}": str(len(matched)),
            "{{lp_path}}": esc(cfg["lp_path"]),
            "{{lp_label}}": esc(cfg["lp_label"]),
            "{{cards_html}}": cards_html,
            "{{works_json}}": build_category_works_json(matched),
            "{{cat_nav_html}}": cat_nav_html,
            "{{faq_html}}": faq_html,
            "{{faq_jsonld}}": faq_jsonld,
            "{{breadcrumb_jsonld}}": breadcrumb_jsonld,
            "{{itemlist_jsonld}}": itemlist_jsonld,
            "{{og_image}}": og_image,
            "{{url}}": f"{SITE}/works/category/{slug}",
            # ビルド日ではなく所属作品の実更新日の最大値を使う（毎日変わる嘘の更新日を防ぐ。
            # APIにmodified_ymdが無い間は従来通りビルド日にフォールバック） 2026-06-12
            "{{last_modified}}": (
                max((w.get("modified_ymd") or "" for w in matched), default="")
                or date.today().isoformat()
            )
            + "T03:00:00+09:00",
        }
        out = render_template(template, replacements)
        write_text(CATEGORY_DIR / f"{slug}.html", out)
        generated += 1

    print(
        f"Generated {generated} category pages, "
        f"skipped {skipped} (no matching works), removed {removed} stale files"
    )


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
            remove_file(existing)
            removed += 1

    for w in works:
        out = build_detail_page(w, template, works)
        write_text(WORKS_DIR / f"{w['id']}.html", out)
    print(f"Generated {len(works)} detail pages, removed {removed} stale files")


def update_sitemap(works):
    p = ROOT / "sitemap.xml"
    s = p.read_text(encoding="utf-8")

    # Remove existing BUILD:WORKS block(s). コメント内の「(auto-generated…)」等の
    # 追加テキストや重複ブロックにも対応するため、開始タグは柔軟にマッチさせる。
    s = remove_blocks(s, "WORKS")

    # カテゴリページ用ブロックも同様に除去
    s = remove_blocks(s, "WORKS_CATEGORIES")

    entries = []
    for w in works:
        # lastmod はWP側の実更新日のみ使う。ビルド日を書くと「全記事毎日更新」という
        # 嘘のシグナルになり、Googleがsitemapのlastmodを信用しなくなる(2026-06-12)
        modified = w.get("modified_ymd") or ""
        entries.append(
            url_entry(
                f"{SITE}/works/{w['id']}",
                modified,
                frequency="monthly",
                priority="0.6",
            )
        )
    block = build_block("WORKS", entries, generator="tools/build-works.py")

    # カテゴリページ URL も追加
    cat_entries = []
    for slug, cfg in CATEGORY_PAGES.items():
        # 該当作品が0件のカテゴリは sitemap に含めない（薄いコンテンツ回避）
        matched = [w for w in works if w.get("category") in cfg["data_categories"]]
        if not matched:
            continue
        # カテゴリページの lastmod = 所属作品の実更新日の最大値（無ければ省略）
        cat_modified = max((w.get("modified_ymd") or "" for w in matched), default="")
        cat_entries.append(
            url_entry(
                f"{SITE}/works/category/{slug}",
                cat_modified,
                frequency="weekly",
                priority="0.8",
            )
        )
    cat_block = (
        build_block("WORKS_CATEGORIES", cat_entries, generator="tools/build-works.py")
        if cat_entries
        else ""
    )

    s = append_blocks(s, block, cat_block)
    write_text(p, s)
    print(f"Updated {p}")


def _build():
    try:
        all_works = fetch_works()
    except Exception as e:
        print(f"ERROR fetching works: {e}", file=sys.stderr)
        sys.exit(1)

    bm_works = require_records(filter_for_bm(all_works), label="BizManga works")
    print(f"Total works from WP: {len(all_works)}")
    print(f"BizManga works (show_site='both'): {len(bm_works)}")

    update_works_html(bm_works)
    generate_details(bm_works)
    generate_category_pages(bm_works)
    update_sitemap(bm_works)

    print("Done.")


def main():
    with output_batch(ROOT):
        return _build()


if __name__ == "__main__":
    main()
