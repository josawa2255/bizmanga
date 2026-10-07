#!/usr/bin/env python3
"""
LP事例自動注入スクリプト
- WP API /works から事例を取得
- 各 LP の対象カテゴリで filter（categories 配列対応 + 旧カテゴリマッピング）
- 上位3件を <!-- BUILD:LP-CASES:BEGIN/END --> マーカー間に静的HTML注入
- LP 内で AI / Bot 可視性を確保（JS 実行不要）

GitHub Actions で週1 + 手動実行。実行後は git commit & push。
"""

import re
import sys
from datetime import date
from pathlib import Path

from bm_build import API_BASE, output_batch, require_records, safe_slug, write_text
from bm_build import fetch_json as _fetch_json

ROOT = Path(__file__).resolve().parent.parent  # BizManga/
WP_API = API_BASE + '/works'

# 各 LP のターゲットカテゴリ（複数可。順序は優先度）
LP_CATEGORIES = {
    "product-manga": ["商品紹介", "紹介"],
    "recruit-manga": ["採用"],
    "manga-ad-lp": ["広告", "集客", "IP"],
    "company-manga": ["会社紹介", "企業紹介", "ブランド"],
    "sales-manga": ["営業資料", "営業"],
    "training-manga": ["研修"],
    "inbound-manga": ["インバウンド", "英語版", "海外版", "多言語", "集客"],
    "ir-manga": ["IR"],
}

LP_NAMES = {
    "product-manga": "商品紹介マンガ",
    "recruit-manga": "採用マンガ",
    "manga-ad-lp": "マンガ広告",
    "company-manga": "会社紹介マンガ",
    "sales-manga": "営業資料マンガ",
    "training-manga": "研修マンガ",
    "inbound-manga": "インバウンド漫画",
    "ir-manga": "IR漫画・周年史マンガ",
}

MAX_CASES_PER_LP = 3
# 8本とも LP v2 の CHAPTER 04 に事例を置く（tools/test_build.py が v2 であることを保証）
CHAPTER_NUM = "04"


def fetch_works():
    """Fetch and validate all work identities before updating any LP."""
    cb = int(date.today().strftime("%Y%m%d"))
    works = require_records(_fetch_json(f"{WP_API}?per_page=100&_cb={cb}"), label="LP works")
    for work in works:
        safe_slug(work["id"])
    return works


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


def esc(s):
    """事例カード用のエスケープ。& < > " だけを置き換える（' はそのまま）。

    bm_build.escape_html は ' も &#x27; にするため、LP に出る文字列が変わらないよう別に持つ。
    """
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
    """1事例分の静的 HTML カード（LP v2 の .lpv2-* マークアップ）。"""
    wid = work.get("id", "")
    title = esc(work.get("title_ja", ""))
    client = esc(work.get("client", ""))
    pages = int(work.get("pages") or 0)
    spec = work.get("spec") or {}
    period = esc(spec.get("period", ""))
    point = esc(work.get("point", ""))
    comment = esc(work.get("comment", ""))
    media_list = work.get("media", []) or []
    media = " / ".join(esc(m) for m in media_list[:3])
    thumb = work.get("thumbnail") or ""
    cats_display = " / ".join(esc(c) for c in get_work_categories(work))

    # サムネ ALT 文言: 作品名 + クライアント
    alt = (
        f"{work.get('title_ja', '')}（{work.get('client', '')}）"
        if client
        else work.get("title_ja", "")
    )

    parts = ['          <article class="lpv2-case">']
    if thumb:
        parts.append(
            f'            <a class="lpv2-case__thumb" href="/works/{wid}" aria-label="{title} の詳細を見る">'
        )
        parts.append(
            f'              <img src="{esc(thumb)}" alt="{esc(alt)}" loading="lazy" width="240" height="300">'
        )
        parts.append("            </a>")
    parts.append('            <div class="lpv2-case__body">')
    parts.append(
        f'              <p class="lpv2-case__meta">{cats_display}'
        + (f" / {pages}P" if pages else "")
        + (f" / {period}" if period else "")
        + "</p>"
    )
    parts.append(
        f'              <h3 class="lpv2-case__title"><a href="/works/{wid}">{title}</a></h3>'
    )
    if client:
        parts.append(
            f'              <p class="lpv2-case__client">クライアント: {client}'
            + (f"／媒体: {media}" if media else "")
            + "</p>"
        )
    if point:
        parts.append(f'              <p class="lpv2-case__point">{point}</p>')
    if comment:
        parts.append(
            f'              <blockquote class="lpv2-case__quote">「{comment}」</blockquote>'
        )
    parts.append(
        f'              <a class="lpv2-case__more" href="/works/{wid}">この事例を詳しく見る →</a>'
    )
    parts.append("            </div>")
    parts.append("          </article>")
    return "\n".join(parts)


def render_section(lp_name, works):
    """LP 用の事例セクション全体。0件のときは準備中の案内と一覧への導線を出す。"""
    head = (
        "\n    <!-- BUILD:LP-CASES:BEGIN (auto-generated by tools/build-lp-cases.py) -->\n"
        f'    <section class="lpv2-section lpv2-cases" id="chapter-04-cases" aria-label="{lp_name}の制作事例">\n'
        '      <div class="lpv2-container">\n'
        '        <header class="lpv2-section-head">\n'
        f'          <span class="lpv2-chapter-num">{CHAPTER_NUM}</span>\n'
        f'          <span class="lpv2-chapter-mark">CHAPTER {CHAPTER_NUM} &middot; CASE STUDY</span>\n'
        '          <h2 class="lpv2-h2">制作事例</h2>\n'
    )
    tail = "      </div>\n    </section>\n    <!-- BUILD:LP-CASES:END -->\n"
    if not works:
        return (
            head
            + '          <p class="lpv2-lead lpv2-lead--center">該当ジャンルの事例は現在準備中です。<a href="/works">全作品一覧</a>または<a href="/biz-library">ビズ書庫</a>から関連作品をご覧ください。</p>\n'
            + "        </header>\n"
            + tail
        )
    cards = "\n".join(render_card(w) for w in works)
    return (
        head
        + f'          <p class="lpv2-lead lpv2-lead--center">{lp_name}として実際に納品した事例から、抜粋してご紹介します。</p>\n'
        + "        </header>\n"
        + '        <div class="lpv2-cases-grid">\n'
        + f"{cards}\n"
        + "        </div>\n"
        + '        <p class="lpv2-cases-foot"><a href="/works" class="lpv2-btn lpv2-btn--ghost">制作事例の一覧を見る →</a></p>\n'
        + tail
    )


def is_v2_lp(slug):
    """LP HTML 内に <!-- LP-DESIGN:v2 --> マーカーがあるか。"""
    path = ROOT / f"{slug}.html"
    if not path.exists():
        return False
    try:
        head = path.read_text(encoding="utf-8")
    except Exception:
        return False
    return "LP-DESIGN:v2" in head


def patch_lp(slug, section_html):
    path = ROOT / f"{slug}.html"
    src = path.read_text(encoding="utf-8")
    original = src
    starts = src.count("<!-- BUILD:LP-CASES:BEGIN")
    ends = src.count("<!-- BUILD:LP-CASES:END -->")
    if starts != ends or starts > 1:
        raise ValueError(f"{slug}: malformed or duplicate LP cases markers")

    # 既存 BUILD:LP-CASES マーカー区間を削除（毎回ビズ書庫埋込の直前に配置し直す）
    pat_existing = re.compile(
        r"\n\s*<!-- BUILD:LP-CASES:BEGIN[^>]*-->.*?<!-- BUILD:LP-CASES:END -->\n",
        re.DOTALL,
    )
    src = pat_existing.sub("\n", src)

    def insert_at(position):
        # Canonical boundary whitespace prevents every rebuild adding blank lines.
        return (
            src[:position].rstrip()
            + "\n"
            + section_html.strip("\n")
            + "\n\n    "
            + src[position:].lstrip()
        )

    # 配置位置: CHAPTER 05 LIBRARY (id="chapter-05-library") の直前（コメントがあればその前）
    m_v2 = re.search(
        r'(\s*<!--[^\n]*CHAPTER 05[^\n]*-->\s*\n)?(\s*<section[^>]*\bid="chapter-05-library")', src
    )
    if not m_v2:
        raise ValueError(f"{slug}: LP cases anchor not found")
    new_src = insert_at(m_v2.start())

    if new_src == original:
        return False
    write_text(path, new_src)
    return True


def _build():
    try:
        works = fetch_works()
    except Exception as e:
        print(f"ERROR fetching works: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Fetched {len(works)} works from WP API")

    summary = {}
    for slug in LP_CATEGORIES:
        if not is_v2_lp(slug):
            raise ValueError(f"{slug}: <!-- LP-DESIGN:v2 --> marker not found")
        matched = filter_for_lp(works, slug)
        top = select_top(matched, MAX_CASES_PER_LP)
        section = render_section(LP_NAMES[slug], top)
        ok = patch_lp(slug, section)
        summary[slug] = {
            "matched": len(matched),
            "shown": len(top),
            "patched": ok,
            "titles": [w.get("title_ja") for w in top],
        }

    print("\n=== 各LPへの注入結果 ===")
    for slug, info in summary.items():
        print(
            f"  {slug}: matched={info['matched']}, shown={info['shown']}, patched={info['patched']}"
        )
        for t in info["titles"]:
            print(f"      - {t}")


def main():
    with output_batch(ROOT):
        return _build()


if __name__ == "__main__":
    main()
