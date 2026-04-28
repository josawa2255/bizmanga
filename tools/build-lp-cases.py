#!/usr/bin/env python3
"""
LP事例自動注入スクリプト
- WP API /works から事例を取得
- 各 LP の対象カテゴリで filter（categories 配列対応 + 旧カテゴリマッピング）
- 上位3件を <!-- BUILD:LP-CASES:BEGIN/END --> マーカー間に静的HTML注入
- LP 内で AI / Bot 可視性を確保（JS 実行不要）

GitHub Actions で週1 + 手動実行。実行後は git commit & push。
"""
import json
import re
import sys
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parent.parent  # BizManga/
SITE = "https://bizmanga.contentsx.jp"
WP_API = "https://cms.contentsx.jp/wp-json/contentsx/v1/works"

# 各 LP のターゲットカテゴリ（複数可。順序は優先度）
LP_CATEGORIES = {
    "product-manga":  ["商品紹介", "紹介"],
    "recruit-manga":  ["採用"],
    "manga-ad-lp":    ["広告", "集客", "IP"],
    "company-manga":  ["会社紹介", "企業紹介", "ブランド"],
    "sales-manga":    ["営業資料", "営業"],
    "training-manga": ["研修"],
    "inbound-manga":  ["インバウンド", "英語版", "海外版", "多言語"],
    "ir-manga":       ["IR"],
}

LP_NAMES = {
    "product-manga":  "商品紹介マンガ",
    "recruit-manga":  "採用マンガ",
    "manga-ad-lp":    "マンガ広告",
    "company-manga":  "会社紹介マンガ",
    "sales-manga":    "営業資料マンガ",
    "training-manga": "研修マンガ",
    "inbound-manga":  "インバウンド漫画",
    "ir-manga":       "IR漫画・周年史マンガ",
}

MAX_CASES_PER_LP = 3


def fetch_works():
    """WP API から全作品取得。"""
    cb = int(date.today().strftime("%Y%m%d"))
    url = f"{WP_API}?per_page=100&_cb={cb}"
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read())


def get_work_categories(w):
    """categories 配列を取得（fallback: category 単数 → リスト化）。"""
    cats = w.get("categories")
    if cats and isinstance(cats, list):
        return cats
    cat = w.get("category")
    return [cat] if cat else []


def has_static_detail(work):
    """/works/{slug}.html が存在するか。
    存在しないと 404→/biz-library?manga={id} (漫画ビューア) にリダイレクトされてしまうため、
    LP の CASE STUDY にはここを通った作品だけを出す。"""
    slug = work.get("id", "")
    if not slug:
        return False
    return (ROOT / "works" / f"{slug}.html").exists()


def filter_for_lp(works, lp_slug):
    """LP のターゲットカテゴリにマッチし、かつ静的詳細ページが存在する作品を返す。"""
    targets = set(LP_CATEGORIES[lp_slug])
    matched = []
    for w in works:
        wcats = set(get_work_categories(w))
        if not (wcats & targets):
            continue
        if not has_static_detail(w):
            # show_site!=both 等で /works/{slug}.html が無い作品は CASE STUDY から除外
            continue
        matched.append(w)
    return matched


def select_top(works, n):
    """hero_order_bm の昇順、なければ pages の降順、で上位 n 件。"""
    def key(w):
        order = w.get("hero_order_bm") or w.get("hero_order_cx") or 9999
        return (order, -int(w.get("pages") or 0))
    return sorted(works, key=key)[:n]


def html_escape(s):
    if s is None:
        return ""
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def render_card(work):
    """1事例分の静的 HTML カード。"""
    wid = work.get("id", "")
    title = html_escape(work.get("title_ja", ""))
    subtitle = html_escape(work.get("subtitle_ja", "") or "")
    client = html_escape(work.get("client", ""))
    pages = int(work.get("pages") or 0)
    spec = work.get("spec") or {}
    period = html_escape(spec.get("period", ""))
    point = html_escape(work.get("point", ""))
    comment = html_escape(work.get("comment", ""))
    media_list = work.get("media", []) or []
    media = " / ".join(html_escape(m) for m in media_list[:3])
    thumb = work.get("thumbnail") or ""
    cats_display = " / ".join(html_escape(c) for c in get_work_categories(work))

    # サムネ ALT 文言: 作品名 + クライアント
    alt = f"{title}（{client}）" if client else title

    parts = [
        '          <article class="pm-case-card">',
    ]
    if thumb:
        parts.append(
            f'            <a class="pm-case-thumb" href="/works/{wid}" aria-label="{title} の詳細を見る">'
        )
        parts.append(
            f'              <img src="{html_escape(thumb)}" alt="{html_escape(alt)}" loading="lazy" width="240" height="300">'
        )
        parts.append("            </a>")
    parts.append('            <div class="pm-case-body">')
    parts.append(
        f'              <span class="pm-case-meta">{cats_display}'
        + (f" / {pages}P" if pages else "")
        + (f" / {period}" if period else "")
        + "</span>"
    )
    parts.append(f'              <h3 class="pm-case-title">')
    parts.append(f'                <a href="/works/{wid}">{title}</a>')
    parts.append(f"              </h3>")
    if client:
        parts.append(f'              <p class="pm-case-client">クライアント: {client}'
                     + (f"／媒体: {media}" if media else "")
                     + "</p>")
    if point:
        parts.append(f'              <p class="pm-case-point">{point}</p>')
    if comment:
        parts.append(
            f'              <blockquote class="pm-case-comment">「{comment}」</blockquote>'
        )
    parts.append(f'              <a class="pm-case-more" href="/works/{wid}">この事例を詳しく見る →</a>')
    parts.append("            </div>")
    parts.append("          </article>")
    return "\n".join(parts)


def render_section(slug, lp_name, works):
    """LP 用の事例セクション全体。CASE STUDY ヘッダーで統一。"""
    if not works:
        return (
            "\n    <!-- BUILD:LP-CASES:BEGIN (auto-generated by tools/build-lp-cases.py) -->\n"
            f'    <section class="pm-section pm-cases-static" aria-label="{lp_name}の制作事例">\n'
            '      <div class="pm-container pm-container--narrow">\n'
            '        <div style="text-align:center; margin-bottom:48px;">\n'
            '          <span class="pm-eyebrow">CASE STUDY</span>\n'
            '          <h2 class="pm-h2">制作事例</h2>\n'
            f'          <p class="pm-lead" style="text-align:center; max-width:560px; margin:0 auto;">該当ジャンルの事例は現在準備中です。<a href="/works">全作品一覧</a>または<a href="/biz-library">ビズ書庫</a>から関連作品をご覧ください。</p>\n'
            '        </div>\n'
            "      </div>\n"
            "    </section>\n"
            "    <!-- BUILD:LP-CASES:END -->\n"
        )
    cards = "\n".join(render_card(w) for w in works)
    return (
        "\n    <!-- BUILD:LP-CASES:BEGIN (auto-generated by tools/build-lp-cases.py) -->\n"
        f'    <section class="pm-section pm-cases-static" aria-label="{lp_name}の制作事例">\n'
        '      <div class="pm-container pm-container--narrow">\n'
        '        <div style="text-align:center; margin-bottom:48px;">\n'
        '          <span class="pm-eyebrow">CASE STUDY</span>\n'
        '          <h2 class="pm-h2">制作事例</h2>\n'
        f'          <p class="pm-lead" style="text-align:center; max-width:560px; margin:0 auto;">{lp_name}として実際に納品した事例から、抜粋してご紹介します。</p>\n'
        '        </div>\n'
        '        <div class="pm-cases-grid">\n'
        f"{cards}\n"
        '        </div>\n'
        '        <p class="pm-cases-foot" style="text-align:center; margin-top:48px;"><a href="/works" class="pm-btn pm-btn--ghost">制作事例の一覧を見る</a></p>\n'
        "      </div>\n"
        "    </section>\n"
        "    <!-- BUILD:LP-CASES:END -->\n"
    )


def patch_lp(slug, section_html):
    path = ROOT / f"{slug}.html"
    src = path.read_text(encoding="utf-8")

    # 1. 既存の動的「CASE STUDY 制作事例」セクション (data-bm-lp-cases) を削除
    pat_dynamic = re.compile(
        r'\s*(?:<!-- ===== 5\. 制作事例[^\n]*\n)?'
        r'\s*<section\s[^>]*\bdata-bm-lp-cases\b[^>]*>.*?</section>\s*\n',
        re.DOTALL | re.IGNORECASE,
    )
    src = pat_dynamic.sub("\n", src, count=1)

    # 2. 既存 BUILD:LP-CASES マーカー区間を削除（毎回ビズ書庫埋込の直前に配置し直す）
    pat_existing = re.compile(
        r"\n\s*<!-- BUILD:LP-CASES:BEGIN[^>]*-->.*?<!-- BUILD:LP-CASES:END -->\n",
        re.DOTALL,
    )
    src = pat_existing.sub("\n", src)

    # 3. ビズ書庫埋込 (id="library") のセクション開始タグ直前に挿入
    # コメント "<!-- ===== 6. ビズ書庫埋込 ... -->" がある場合はそれごと前に置く
    m = re.search(r'(\s*<!--[^\n]*ビズ書庫埋込[^\n]*-->\s*\n)?(\s*<section[^>]*\bid="library")', src)
    if m:
        # マッチ全体（コメント+セクション開始）の前に section_html を挿入
        start = m.start()
        new_src = src[:start] + section_html + src[start:]
    else:
        # フォールバック: 制作フロー直前
        anchor_flow = re.compile(r'(\n    <!-- ===== 制作フロー[^>]*-->)')
        if not anchor_flow.search(src):
            print(f"[FAIL] {slug}: anchor not found", file=sys.stderr)
            return False
        new_src = anchor_flow.sub(section_html + r"\1", src, count=1)

    if new_src == src:
        return False
    path.write_text(new_src, encoding="utf-8")
    return True


def main():
    try:
        works = fetch_works()
    except Exception as e:
        print(f"ERROR fetching works: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Fetched {len(works)} works from WP API")

    summary = {}
    for slug in LP_CATEGORIES:
        matched = filter_for_lp(works, slug)
        top = select_top(matched, MAX_CASES_PER_LP)
        section = render_section(slug, LP_NAMES[slug], top)
        ok = patch_lp(slug, section)
        summary[slug] = {
            "matched": len(matched),
            "shown": len(top),
            "patched": ok,
            "titles": [w.get("title_ja") for w in top],
        }

    print("\n=== 各LPへの注入結果 ===")
    for slug, info in summary.items():
        print(f"  {slug}: matched={info['matched']}, shown={info['shown']}, patched={info['patched']}")
        for t in info["titles"]:
            print(f"      - {t}")


if __name__ == "__main__":
    main()
