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
from datetime import date
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


# カテゴリ別の活用シーン解説（SEO 用本文増強、約 200-300 字 / カテゴリ）
CATEGORY_USECASE = {
    "採用": "採用マンガは新卒・中途・アルバイト採用の各フェーズで活用できます。会社説明会での導入動画、採用パンフレット、採用サイトのファーストビュー、SNS（X／Instagram／TikTok）配信、内定者フォローなど、求職者の目線で「この会社で働く一日」「先輩との関わり」「成長の物語」を描くことで、応募意欲・志望度・内定承諾率を高めます。Z世代の入社後リアリティショック対策として、光と影の両面を見せる構成も有効です。",
    "商品紹介": "商品紹介マンガはBtoB SaaS・無形商材・複雑な商品の説明CVRを劇的に改善します。LP（ランディングページ）、パンフレット、SNS広告、オウンドメディア、営業資料など、複数媒体に展開可能。機能比較ではなく「導入後の物語」として価値を伝えるため、購買検討者の感情を動かしやすく、滞在時間・回遊率・問い合わせ率の向上が期待できます。",
    "営業資料": "営業資料マンガは商談現場、提案書、稟議資料、社内勉強会など、BtoB営業の各フェーズで活用できます。担当者から決裁者への「伝言ゲーム」で情報量が劣化する課題を、漫画なら「物語のまま」届けることで解消。インサイドセールスのオンライン商談、フィールドセールスのプレゼン、カスタマーサクセスの定例会まで、営業プロセス全体で受注率と説明品質均一化に貢献します。",
    "営業": "営業現場で使う漫画資料は、商談、提案書、社内勉強会、稟議資料への添付など多用途。担当者から決裁者へ「物語のまま」情報を届けることで、伝言ゲームでの情報劣化を防ぎます。インサイドセールスのオンライン商談、フィールドセールスのプレゼン、カスタマーサクセスのフォローなど、営業プロセス全体で活用可能です。",
    "研修": "研修マンガは新人研修、コンプライアンス研修、ハラスメント防止研修、店舗OJT、e-learning、管理職向け研修など、社員教育のあらゆる場面で活用できます。動画やテキストでは形骸化しがちな研修を「失敗事例の安全な疑似体験」に変換し、社員の理解度・実践率・記憶定着を高めます。LMS（学習管理システム）との連携、SCORM形式での書き出し、法改正対応の年次更新も対応可能です。",
    "広告": "マンガ広告は Meta（旧Facebook）・Instagram・TikTok・LINE NEWS・Yahoo!ディスプレイ・GDN など主要 SNS／Web 広告媒体で活用できます。スクロールを止めるストーリー型クリエイティブで、SNS 広告の CTR と LP の CVR を引き上げ、広告疲弊・LP 直帰率の改善に効きます。媒体別サイズ・尺・テキスト比率規制・広告審査ガイドラインに沿った最適化対応が可能です。",
    "集客": "集客用の漫画コンテンツは SNS 配信、メルマガ、Web 広告、オウンドメディア、ホワイトペーパーなど、リード獲得ファネルの各段階で活用できます。読了率・SNS シェア率・メルマガ開封率を高め、認知層から見込み客への引き上げ、見込み客から商談化への引き上げを支援します。",
    "会社紹介": "会社紹介マンガは採用パンフレット、IR文書、統合報告書、周年記念誌、社史、コーポレートサイト、社員ハンドブックなど、ステークホルダー横断で活用できます。創業の想い・企業文化・歴史を「読まれる物語」として伝えることで、求職者・取引先・株主・社員それぞれが共感できる会社像を描き出します。",
    "企業紹介": "企業紹介マンガは採用、IR、周年事業、社史編纂、コーポレートサイト、社員研修など多面的に活用できます。創業者ストーリー・転機・経営哲学を漫画で描くことで、活字では伝わらない「想い」を全ステークホルダーに届けられます。",
    "ブランド": "コーポレートブランディングマンガは創業者ストーリー、企業文化、経営哲学を物語で伝え、採用・IR・取引先・社員に向けた多面的な共感づくりに貢献します。記念誌・統合報告書・社員ハンドブックなど媒体横断での展開も可能です。",
    "インバウンド": "インバウンド漫画は訪日外国人向け観光パンフレット、空港・駅サイネージ、観光協会／自治体／DMO の多言語コンテンツ、宿泊施設・小売店向けの案内ツールとして活用できます。英語・中国語（簡体字・繁体字）・韓国語・タイ語・ベトナム語など主要言語に対応し、ネイティブ校正・文化的配慮（ジェスチャー・色・タブー表現）まで含めて納品します。",
    "IR": "IR漫画は統合報告書、株主通信、株主総会資料、IRサイト掲載、決算説明会、有価証券報告書の補足資料、電子公告対応など、上場企業のIR文書全般で活用できます。個人投資家にビジネスモデルを物語で伝え、機関投資家には事業戦略の解像度を高めます。適時開示ルール・金融商品取引法・将来予測表現ガイドラインに準拠した制作が可能です。",
    "紹介": "紹介系漫画はサービス紹介・商品紹介・コラム連載・SNS発信など多用途で展開できます。複雑なサービスや専門性の高い商品の魅力を、ペルソナの体験として描くことで購買検討者の感情を動かしやすく、シリーズ展開でブランド認知の強化にもつながります。",
    "IP": "IPコラボ漫画はキャラクターIP・タレント・アーティストとの企業コラボ広告、ライセンス商品プロモーション、コンテンツマーケティングなどで活用できます。ファン層の獲得・話題化・SNS 拡散に効果的で、既存IPの世界観を活かしたオリジナルストーリー設計が可能です。",
}


# LP（用途別ランディングページ）への内部リンクマッピング
CATEGORY_LP_LINK = {
    "採用": ("/recruit-manga", "採用マンガ制作"),
    "商品紹介": ("/product-manga", "商品紹介マンガ制作"),
    "営業資料": ("/sales-manga", "営業資料マンガ制作"),
    "営業": ("/sales-manga", "営業資料マンガ制作"),
    "研修": ("/training-manga", "研修マンガ制作"),
    "広告": ("/manga-ad-lp", "マンガ広告制作"),
    "集客": ("/manga-ad-lp", "マンガ広告制作"),
    "会社紹介": ("/company-manga", "会社紹介マンガ制作"),
    "企業紹介": ("/company-manga", "会社紹介マンガ制作"),
    "ブランド": ("/company-manga", "会社紹介マンガ制作"),
    "インバウンド": ("/inbound-manga", "インバウンド漫画制作"),
    "IR": ("/ir-manga", "IRマンガ制作"),
    "紹介": ("/product-manga", "商品紹介マンガ制作"),
    "IP": ("/manga-ad-lp", "マンガ広告制作"),
}


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
    # ヒーロー表示用は gallery[0] のフル解像度を優先 (WP thumbnail は 188x300 の小さなサムネで、
    # 1200x630 として引き延ばすと画質劣化 + LCP要素として機能しないため)。
    # fallback として従来の thumbnail → gallery[0] 順で参照。
    gallery_list = w.get("gallery") or []
    hero_src = gallery_list[0] if gallery_list else (w.get("thumbnail") or "")
    thumb = hero_src  # 後方互換で thumb 変数名も維持
    category = w.get("category") or "制作事例"
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

    gallery_html = "\n".join(
        f'          <img src="{esc(g)}" alt="{esc(title_ja)} ページ{i+1}" loading="lazy" decoding="async">'
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
        rw for rw in _all_works_cache
        if rw.get("category") == category
        and rw.get("id") != slug
        and rw.get("show_site") == "both"
    ][:3]
    if related_works:
        related_cards = []
        for rw in related_works:
            r_thumb = rw.get("thumbnail") or (rw.get("gallery") or [""])[0]
            related_cards.append(
                f'          <a class="bm-work-related-card" href="/works/{esc(rw["id"])}">\n'
                f'            <img src="{esc(r_thumb)}" alt="{esc(rw.get("title_ja",""))}" loading="lazy" width="200" height="280">\n'
                f'            <span class="bm-work-related-name">{esc(rw.get("title_ja",""))}</span>\n'
                f'          </a>'
            )
        related_section = (
            '      <section class="bm-work-detail-section">\n'
            f'        <h2>{esc(category)}の関連事例</h2>\n'
            '        <div class="bm-work-related-grid">\n'
            + "\n".join(related_cards) + "\n"
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
        "{{title_en}}": esc(title_en),
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

    out = template
    for k, v in replacements.items():
        out = out.replace(k, v)
    return out


_all_works_cache = []


def generate_details(works):
    global _all_works_cache
    _all_works_cache = list(works)
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
            f"    <lastmod>{date.today().isoformat()}</lastmod>\n"
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
