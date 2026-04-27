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
    "inbound-manga":  ["インバウンド"],
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


def filter_for_lp(works, lp_slug):
    """LP のターゲットカテゴリにマッチする作品を返す。"""
    targets = set(LP_CATEGORIES[lp_slug])
    matched = []
    for w in works:
        wcats = set(get_work_categories(w))
        if wcats & targets:
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
    """1事例分の静的 HTML カード。
    モーダル表示用に [data-work-modal-id] + data-work (JSON) を付与。
    SEO のため詳細ページリンクも併存。
    """
    import json as _json
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

    # bm-work-modal.js に渡す JSON データ（必要最小限）
    work_json = _json.dumps({
        "id": work.get("id", ""),
        "title_ja": work.get("title_ja", ""),
        "category": (get_work_categories(work) or [""])[0],
        "pages": work.get("pages", 0),
        "spec": work.get("spec", {}),
        "media": work.get("media", []),
        "point": work.get("point", ""),
        "comment": work.get("comment", ""),
        "gallery": work.get("gallery", []),
        "view_type": work.get("view_type", "spread"),
    }, ensure_ascii=False)
    work_attr = work_json.replace("&", "&amp;").replace("'", "&#39;").replace('"', "&quot;")

    # サムネ ALT 文言
    alt = f"{title}（{client}）" if client else title

    parts = [
        '          <article class="pm-case-card">',
    ]
    if thumb:
        parts.append(
            f'            <button type="button" class="pm-case-thumb pm-case-thumb-button"'
            f' data-work-modal-id="{html_escape(wid)}" data-work="{work_attr}"'
            f' aria-label="{title} の漫画を見る">'
        )
        parts.append(
            f'              <img src="{html_escape(thumb)}" alt="{html_escape(alt)}" loading="lazy" width="240" height="300">'
        )
        parts.append("            </button>")
    parts.append('            <div class="pm-case-body">')
    parts.append(
        f'              <span class="pm-case-meta">{cats_display}'
        + (f" / {pages}P" if pages else "")
        + (f" / {period}" if period else "")
        + "</span>"
    )
    parts.append(f'              <h3 class="pm-case-title">')
    parts.append(
        f'                <button type="button" class="pm-case-title-button"'
        f' data-work-modal-id="{html_escape(wid)}" data-work="{work_attr}">{title}</button>'
    )
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
    parts.append(
        f'              <button type="button" class="pm-case-more pm-case-more-button"'
        f' data-work-modal-id="{html_escape(wid)}" data-work="{work_attr}">'
        f'漫画を読む（モーダル） ▶</button>'
    )
    parts.append(
        f'              <a class="pm-case-detail-link" href="/works/{html_escape(wid)}">詳細ページへ →</a>'
    )
    parts.append("            </div>")
    parts.append("          </article>")
    return "\n".join(parts)


def render_section(slug, lp_name, works):
    """LP 用の事例セクション全体。"""
    if not works:
        # 該当事例ゼロでも誘導文だけは置く（CTRリスクと SEO の妥協点）
        return (
            "\n    <!-- BUILD:LP-CASES:BEGIN (auto-generated by tools/build-lp-cases.py) -->\n"
            f'    <section class="pm-section pm-cases-static" aria-label="{lp_name}の制作事例">\n'
            '      <div class="pm-container pm-container--narrow">\n'
            '        <span class="pm-section-eyebrow">CASE STUDIES</span>\n'
            f'        <h2 class="pm-section-title">{lp_name}の制作事例</h2>\n'
            f'        <p class="pm-section-lead">該当ジャンルの事例は現在準備中です。<a href="/works">全作品一覧</a>または<a href="/biz-library">ビズ書庫</a>から関連作品をご覧ください。</p>\n'
            "      </div>\n"
            "    </section>\n"
            "    <!-- BUILD:LP-CASES:END -->\n"
        )
    cards = "\n".join(render_card(w) for w in works)
    return (
        "\n    <!-- BUILD:LP-CASES:BEGIN (auto-generated by tools/build-lp-cases.py) -->\n"
        f'    <section class="pm-section pm-cases-static" aria-label="{lp_name}の制作事例">\n'
        '      <div class="pm-container pm-container--narrow">\n'
        '        <span class="pm-section-eyebrow">CASE STUDIES</span>\n'
        f'        <h2 class="pm-section-title">{lp_name}の制作事例</h2>\n'
        f'        <p class="pm-section-lead">実際にビズマンガが制作した{lp_name}の事例から、業種別・目的別の代表例をご紹介します。各事例の詳細ページでは漫画原稿のサンプルや制作プロセスもご覧いただけます。</p>\n'
        '        <div class="pm-cases-grid">\n'
        f"{cards}\n"
        '        </div>\n'
        '        <p class="pm-cases-foot"><a href="/works" class="pm-btn pm-btn--ghost">すべての制作事例を見る →</a></p>\n'
        "      </div>\n"
        "    </section>\n"
        "    <!-- BUILD:LP-CASES:END -->\n"
    )


def patch_lp(slug, section_html):
    path = ROOT / f"{slug}.html"
    src = path.read_text(encoding="utf-8")

    # 既存マーカー区間があれば置換、無ければ pm-flow-section 直前に挿入
    pattern_existing = re.compile(
        r"\n\s*<!-- BUILD:LP-CASES:BEGIN[^>]*-->.*?<!-- BUILD:LP-CASES:END -->\n",
        re.DOTALL,
    )
    if pattern_existing.search(src):
        new_src = pattern_existing.sub(section_html, src, count=1)
    else:
        # 制作フロー直前に挿入
        anchor = re.compile(r'(\n    <!-- ===== 制作フロー[^>]*-->)')
        if not anchor.search(src):
            print(f"[FAIL] {slug}: 制作フロー アンカー見つからず", file=sys.stderr)
            return False
        new_src = anchor.sub(section_html + r"\1", src, count=1)

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
