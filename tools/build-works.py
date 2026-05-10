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
CATEGORY_TEMPLATE_PATH = ROOT / "tools" / "templates" / "works-category.html.tpl"
WORKS_DIR = ROOT / "works"
CATEGORY_DIR = ROOT / "works" / "category"


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


# ===== カテゴリページ設定 =====
# /works/category/{slug} で生成される事例集約ページの設計
# data_categories: WP API の category フィールド値（OR 条件で集約）
# kw / kw_short: SEO ターゲットKW、画面表示用（H1・タイトル等）
# title_seo: <title> （65文字以内推奨）
# description: <meta description>（120-160 文字）
# intro_lead: ヒーロー直下のリード文（120-200 字）
# lp_path / lp_label: 用途別LPへの内部リンク
# faq: FAQ JSON-LD と表示用 [{q, a}, ...]
CATEGORY_PAGES = {
    "recruit": {
        "data_categories": ["採用"],
        "kw": "採用マンガ制作",
        "kw_short": "採用マンガ",
        "title_seo": "採用マンガ制作事例｜会社紹介・社員インタビュー実績｜ビズマンガ",
        "description": "採用マンガ・採用漫画の制作事例集。会社紹介、社員インタビュー、仕事内容の漫画化など、新卒・中途採用向けに制作した実績を全公開。応募意欲・内定承諾率を高める採用ブランディング事例を業種別にご覧いただけます。",
        "keywords": "採用マンガ 事例,採用漫画 実績,採用パンフレット 漫画,会社紹介 漫画,新卒採用 マンガ,中途採用 マンガ",
        "intro_lead": "求職者に「働く姿」を物語で伝え、応募意欲・志望度・内定承諾率を高めた採用マンガの制作事例を公開しています。新卒・中途・アルバイト採用、各フェーズで活用できる実績をご覧ください。",
        "lp_path": "/recruit-manga",
        "lp_label": "採用マンガ制作",
        "faq": [
            {"q": "採用マンガはどんな場面で使えますか？", "a": "採用サイトのファーストビュー、採用パンフレット、会社説明会の導入動画、SNS（X/Instagram/TikTok）配信、内定者フォローまで幅広く活用できます。"},
            {"q": "新卒採用向けと中途採用向けで内容は変わりますか？", "a": "はい。新卒向けは入社後のリアリティと成長物語、中途向けは仕事の裁量・スピード・カルチャーマッチを重視した構成にします。ターゲット別に脚本を最適化します。"},
            {"q": "1冊あたりの制作期間はどれくらいですか？", "a": "標準的な10ページ構成で約4〜6週間が目安です。ヒアリング・脚本・ネーム・作画・修正の各フェーズをワンストップで進行します。"},
            {"q": "費用感を教えてください。", "a": "1ページ15,800円〜（基本プラン）。10ページ構成で約17.4万円〜が目安です。詳細は無料お見積もりにてご案内します。"},
        ],
    },
    "product": {
        "data_categories": ["商品紹介", "紹介"],
        "kw": "商品紹介マンガ制作",
        "kw_short": "商品紹介マンガ",
        "title_seo": "商品紹介マンガ制作事例｜BtoB SaaS・無形商材の漫画化実績｜ビズマンガ",
        "description": "商品紹介マンガ・サービス説明漫画の制作事例集。BtoB SaaS、無形商材、複雑な商品の魅力を物語で伝えた実績を業種別に多数公開。LP・営業資料・展示会・SNS用に展開できる商品漫画事例をご覧いただけます。",
        "keywords": "商品紹介マンガ 事例,サービス紹介 漫画,SaaS マンガ,BtoB 漫画 事例,商品漫画 実績",
        "intro_lead": "BtoB SaaSや無形商材、複雑な商品の魅力をストーリーで伝え、LP・営業資料・展示会で成果を上げた商品紹介マンガの制作事例を業種別に公開しています。",
        "lp_path": "/product-manga",
        "lp_label": "商品紹介マンガ制作",
        "faq": [
            {"q": "商品紹介マンガはどんな媒体で展開できますか？", "a": "LP（ランディングページ）、商品パンフレット、SNS広告、オウンドメディア、展示会パネル、営業資料など、複数媒体に展開可能です。"},
            {"q": "BtoB SaaSなど抽象的な商品でも漫画化できますか？", "a": "はい。機能比較ではなく「導入後の物語」として価値を伝えるアプローチが得意です。専門用語を避けたペルソナ視点の脚本でCVR改善に貢献します。"},
            {"q": "ターゲットや訴求軸はどう決めるのですか？", "a": "初回ヒアリングで現状の課題、ターゲット像、競合との差別化ポイントを整理し、脚本の方向性を決めます。お客様の営業資料も参考に最適化します。"},
            {"q": "短納期にも対応できますか？", "a": "通常4〜6週間の制作期間を、特急対応で2〜3週間に短縮可能です（別途特急料金）。展示会・キャンペーン日程に合わせてご相談ください。"},
        ],
    },
    "sales": {
        "data_categories": ["営業"],
        "kw": "営業マンガ制作",
        "kw_short": "営業マンガ",
        "title_seo": "営業マンガ制作事例｜営業資料・商談用漫画の実績｜ビズマンガ",
        "description": "営業マンガ・営業資料漫画の制作事例集。BtoB商談、提案書、稟議資料の漫画化で、決裁者への伝言ゲーム劣化を防ぎ、受注率と説明品質均一化に貢献した実績を公開。インサイドセールスからフィールドセールスまで対応。",
        "keywords": "営業マンガ 事例,営業資料 漫画,商談用 マンガ,BtoB営業 漫画,提案書 漫画化",
        "intro_lead": "BtoB商談・提案書・稟議資料の漫画化で、担当者から決裁者への情報劣化を防ぎ、受注率を上げた営業マンガの制作事例を公開しています。",
        "lp_path": "/sales-manga",
        "lp_label": "営業資料マンガ制作",
        "faq": [
            {"q": "営業マンガはどう活用できますか？", "a": "商談現場、提案書添付、稟議資料、社内勉強会、インサイドセールスのオンライン商談、カスタマーサクセスの定例会など営業プロセス全体で活用できます。"},
            {"q": "なぜ漫画にすると営業効果が上がるのですか？", "a": "テキスト資料は要点だけ伝わり、口頭説明に依存します。漫画なら「物語のまま」担当者→決裁者へ情報が劣化なく伝わり、稟議通過率と理解度が高まります。"},
            {"q": "業界・商材を問わず対応できますか？", "a": "はい。SaaS、製造業、不動産、人材、金融、医療、士業まで幅広い業界の営業マンガを制作してきました。業界特性に合わせた脚本設計が可能です。"},
            {"q": "既存の営業資料との連携は？", "a": "既存資料・サービス紹介スライドを脚本のインプットとして活用します。漫画は「最初の山場」を担当し、テキスト資料は詳細補足として組み合わせるのが効果的です。"},
        ],
    },
    "company": {
        "data_categories": ["ブランド", "紹介"],
        "kw": "会社紹介マンガ制作",
        "kw_short": "会社紹介マンガ",
        "title_seo": "会社紹介マンガ制作事例｜創業ストーリー・ブランディング実績｜ビズマンガ",
        "description": "会社紹介マンガ・創業ストーリー漫画の制作事例集。企業理念、沿革、ブランドストーリーを物語で伝え、採用・IR・取引先向けに展開した実績を公開。経営者の想いをステークホルダー全員に届けるコーポレートブランディング事例。",
        "keywords": "会社紹介マンガ 事例,創業ストーリー 漫画,ブランディング マンガ,企業紹介 漫画,コーポレート漫画",
        "intro_lead": "経営者の原体験・企業文化・沿革を漫画化し、採用・IR・取引先・社員向けに共感を生み出した会社紹介マンガの制作事例を公開しています。",
        "lp_path": "/company-manga",
        "lp_label": "会社紹介マンガ制作",
        "faq": [
            {"q": "会社紹介マンガはどう使えますか？", "a": "コーポレートサイト、採用パンフレット、IR文書、周年記念誌、社史、社員ハンドブックなど、ステークホルダー横断で活用できます。"},
            {"q": "創業ストーリーをどう物語化するのですか？", "a": "経営者・創業メンバーへのヒアリングを通じて「転機」「葛藤」「決断」を抽出し、感情を動かす構成に再編成します。実話ベースで脚色を最小限に抑えます。"},
            {"q": "上場企業のIR用途にも対応できますか？", "a": "はい。適時開示ルール・金融商品取引法・将来予測表現ガイドラインに準拠した制作経験があります。法務・IR担当者との確認フローも組み込みます。"},
            {"q": "社内に資料がほとんど無くても作れますか？", "a": "問題ありません。経営者インタビュー（90〜120分）と社内取材を通じて、ゼロから物語を組み立てた事例も多数あります。"},
        ],
    },
    "training": {
        "data_categories": ["研修"],
        "kw": "研修マンガ制作",
        "kw_short": "研修マンガ",
        "title_seo": "研修マンガ制作事例｜新人研修・コンプライアンス漫画実績｜ビズマンガ",
        "description": "研修マンガ・教育漫画の制作事例集。新人研修、コンプライアンス、ハラスメント防止、店舗OJT、e-learning向けの漫画化実績を公開。「失敗事例の安全な疑似体験」で社員の理解度・実践率・記憶定着を高めます。",
        "keywords": "研修マンガ 事例,コンプライアンス 漫画,新人研修 マンガ,e-learning 漫画,OJT教材 漫画",
        "intro_lead": "新人研修、コンプライアンス、ハラスメント防止、店舗OJTなど、形骸化しがちな研修を「失敗事例の疑似体験」に変えた研修マンガの制作事例を公開しています。",
        "lp_path": "/training-manga",
        "lp_label": "研修マンガ制作",
        "faq": [
            {"q": "研修マンガはどんなテーマで作れますか？", "a": "コンプライアンス、ハラスメント防止、情報セキュリティ、ビジネスマナー、新人研修、OJT、管理職研修など、社員教育のあらゆるテーマに対応します。"},
            {"q": "LMS（学習管理システム）への組み込みは？", "a": "可能です。SCORM形式での書き出し、社内LMSへの組み込み、理解度テスト連動など、運用フローまで含めて設計します。"},
            {"q": "法改正に合わせた更新はできますか？", "a": "年次更新プランをご用意しています。法改正・ガイドライン変更時に該当ページを差し替え、最新版として継続運用できます。"},
            {"q": "なぜ研修を漫画にすると効果が上がるのですか？", "a": "テキスト・動画では「他人事」になりがちな研修を、漫画なら登場人物の失敗を疑似体験させることで「自分ごと化」させ、行動変容に繋がる学習体験に変換できます。"},
        ],
    },
    "ad": {
        "data_categories": ["集客", "IP"],
        "kw": "マンガ広告制作",
        "kw_short": "マンガ広告",
        "title_seo": "マンガ広告制作事例｜SNS広告・LP・集客漫画の実績｜ビズマンガ",
        "description": "マンガ広告・集客漫画の制作事例集。Meta（Facebook/Instagram）、TikTok、LINE、Yahoo!、GDN向けの広告クリエイティブ、LP用漫画、IPコラボ広告の実績を公開。スクロールを止めるストーリー型クリエイティブでCTR・CVR改善。",
        "keywords": "マンガ広告 事例,SNS広告 漫画,LP 漫画,集客 マンガ,IPコラボ 広告 漫画",
        "intro_lead": "Meta・Instagram・TikTok・LINEなど主要SNS広告と、LP・集客コンテンツでスクロールを止めるマンガクリエイティブを制作した実績を公開しています。",
        "lp_path": "/manga-ad-lp",
        "lp_label": "マンガ広告制作",
        "faq": [
            {"q": "どの媒体の広告に対応できますか？", "a": "Meta（Facebook/Instagram）、TikTok、X（旧Twitter）、LINE NEWS、Yahoo!ディスプレイ、GDN（Googleディスプレイネットワーク）など主要SNS／Web広告媒体に対応します。"},
            {"q": "媒体ごとのサイズ・尺のレギュレーションは？", "a": "各媒体のサイズ・アスペクト比・テキスト比率規制・広告審査ガイドラインを把握しており、入稿仕様に合わせて納品します。動画広告化（モーション付き）にも対応可能です。"},
            {"q": "IPコラボ広告も制作できますか？", "a": "はい。キャラクターIP・タレント・アーティストとの企業コラボ広告、ライセンス商品プロモーション、コンテンツマーケティング等の制作実績があります。"},
            {"q": "A/Bテスト用の複数バージョン制作は？", "a": "可能です。同じ商品でも訴求軸の異なる複数バージョン（感情訴求版／機能訴求版／価格訴求版）を制作し、配信結果に応じて改善版を量産する運用にも対応します。"},
        ],
    },
    "ir": {
        "data_categories": ["IR"],
        "kw": "IR漫画制作",
        "kw_short": "IR漫画",
        "title_seo": "IR漫画制作事例｜統合報告書・株主通信の漫画化実績｜ビズマンガ",
        "description": "IR漫画・統合報告書漫画の制作事例集。株主通信、株主総会資料、IRサイト、決算説明会、有価証券報告書補足資料の漫画化実績を公開。個人投資家にビジネスモデルを物語で伝え、機関投資家の解像度を高めるIRコンテンツ事例。",
        "keywords": "IR漫画 事例,統合報告書 漫画,株主通信 漫画,IRサイト 漫画,決算説明 漫画",
        "intro_lead": "統合報告書、株主通信、株主総会資料、IRサイト掲載など、上場企業のIR文書を漫画化し、個人投資家・機関投資家の理解促進に貢献した制作事例を公開しています。",
        "lp_path": "/ir-manga",
        "lp_label": "IR漫画制作",
        "faq": [
            {"q": "IR文書の漫画化で気をつけるべきことは？", "a": "適時開示ルール・金融商品取引法・将来予測表現ガイドラインへの準拠が必須です。法務・IR担当者との確認フローを制作プロセスに組み込んでいます。"},
            {"q": "統合報告書全体を漫画化できますか？", "a": "全体漫画化、特定章のみ漫画化、見開き1〜2ページの導入漫画など、用途と予算に応じて柔軟に設計します。多くは「経営者メッセージ」「事業戦略」セクションでの活用が効果的です。"},
            {"q": "個人投資家向けと機関投資家向けで違いはありますか？", "a": "はい。個人投資家向けはビジネスモデルを物語で噛み砕く方向、機関投資家向けは事業戦略の解像度を高める補足ビジュアルとしての位置付けが効果的です。"},
            {"q": "IRサイトへの掲載・配信は？", "a": "Web掲載用の最適化（軽量化・スマホ対応・縦読み版）、PDF版（印刷用統合報告書）、SNS配信用の切り出し版など、複数フォーマットでの納品が可能です。"},
        ],
    },
}


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
        if media else ""
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
    return json.dumps(
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
        ensure_ascii=False,
        indent=2,
    )


def build_breadcrumb_jsonld(slug, kw):
    return json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "ホーム", "item": f"{SITE}/"},
                {"@type": "ListItem", "position": 2, "name": "制作事例", "item": f"{SITE}/works"},
                {"@type": "ListItem", "position": 3, "name": kw, "item": f"{SITE}/works/category/{slug}"},
            ],
        },
        ensure_ascii=False,
        indent=2,
    )


def build_itemlist_jsonld(slug, cfg, matched):
    return json.dumps(
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
        ensure_ascii=False,
        indent=2,
    )


def generate_category_pages(works):
    """カテゴリページを /works/category/{slug}.html に生成"""
    if not CATEGORY_TEMPLATE_PATH.exists():
        print(f"WARN: category template not found: {CATEGORY_TEMPLATE_PATH}", file=sys.stderr)
        return
    template = CATEGORY_TEMPLATE_PATH.read_text(encoding="utf-8")
    CATEGORY_DIR.mkdir(parents=True, exist_ok=True)

    # 既存カテゴリHTMLをクリーンアップ
    valid_slugs = set(CATEGORY_PAGES.keys())
    removed = 0
    for existing in CATEGORY_DIR.glob("*.html"):
        if existing.stem not in valid_slugs:
            existing.unlink()
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
                stale.unlink()
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
            "{{cat_nav_html}}": cat_nav_html,
            "{{faq_html}}": faq_html,
            "{{faq_jsonld}}": faq_jsonld,
            "{{breadcrumb_jsonld}}": breadcrumb_jsonld,
            "{{itemlist_jsonld}}": itemlist_jsonld,
            "{{og_image}}": og_image,
            "{{url}}": f"{SITE}/works/category/{slug}",
            "{{last_modified}}": date.today().isoformat() + "T03:00:00+09:00",
        }
        out = template
        for k, v in replacements.items():
            out = out.replace(k, v)
        (CATEGORY_DIR / f"{slug}.html").write_text(out, encoding="utf-8")
        generated += 1

    print(
        f"Generated {generated} category pages, "
        f"skipped {skipped} (no matching works), removed {removed} stale files"
    )


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

    # カテゴリページ用ブロックも同様に除去
    cat_pattern = re.compile(
        r"\s*<!-- BUILD:WORKS_CATEGORIES[^>]*?-->[\s\S]*?<!-- /BUILD:WORKS_CATEGORIES -->\s*"
    )
    s = cat_pattern.sub("\n\n", s)

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

    # カテゴリページ URL も追加
    cat_entries = []
    for slug, cfg in CATEGORY_PAGES.items():
        # 該当作品が0件のカテゴリは sitemap に含めない（薄いコンテンツ回避）
        matched = [w for w in works if w.get("category") in cfg["data_categories"]]
        if not matched:
            continue
        cat_entries.append(
            "  <url>\n"
            f"    <loc>{SITE}/works/category/{slug}</loc>\n"
            f"    <lastmod>{date.today().isoformat()}</lastmod>\n"
            "    <changefreq>weekly</changefreq>\n"
            "    <priority>0.8</priority>\n"
            "  </url>"
        )
    cat_block = (
        "  <!-- BUILD:WORKS_CATEGORIES (auto-generated by tools/build-works.py) -->\n"
        + "\n".join(cat_entries)
        + "\n  <!-- /BUILD:WORKS_CATEGORIES -->\n"
    ) if cat_entries else ""

    inject = block + ("\n" + cat_block if cat_block else "") + "\n"
    s = s.replace("</urlset>", inject + "</urlset>")
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
    generate_category_pages(bm_works)
    update_sitemap(bm_works)

    print("Done.")


if __name__ == "__main__":
    main()
