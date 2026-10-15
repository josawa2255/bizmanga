"""Column list, URLs, dates and text normalization shared by the page and feed builders."""
import datetime
import re
import sys

import bm_build
from bm_build import API_BASE, require_records, safe_slug
from bm_pricing import normalize_price_text

# The column pages and the RSS feed must list the same articles (fetch_columns).
COLUMNS_PER_PAGE = 100
COLUMNS_API = f"{API_BASE}/columns?site=bizmanga&per_page={COLUMNS_PER_PAGE}"
# 掲載先で絞る前の一覧。WP プラグインは「全サイトの新しい順に per_page 件」を取ってから掲載先で絞るので、
# 絞った一覧が per_page 件未満でも、絞る前に切られた BizManga の記事があり得る。これで件数を確かめる
COLUMNS_ALL_SITES_API = f"{API_BASE}/columns?per_page={COLUMNS_PER_PAGE}"
MAX_PAGES = 20

SLUG_MAP = {
    "4コマ漫画をビジネス活用するには": "4koma-business-guide",
    "4コマ漫画の簡単な作り方とビジネス活用法": "4koma-howto",
    "ビジネス漫画の効果とは": "business-manga-effect",
    "漫画の「プロット」とは": "manga-plot-guide",
    "なぜ今、ビジネスに漫画なのか": "why-business-manga",
}


def make_slug(column):
    slug = column.get("slug") or ""
    if slug:
        try:
            return safe_slug(slug)
        except ValueError:
            # 公開URLが変わるので黙って切り替えない（Actions の画面に警告を出す）
            print(f"::warning::column {column.get('id')}: slug {slug!r} is not a safe URL; "
                  "falling back to another URL. Fix the slug in WordPress.", file=sys.stderr)
    title = column.get("title_ja") or ""
    for key, val in SLUG_MAP.items():
        if key in title:
            return val
    return safe_slug(f"column-{column['id']}")


def fetch_page(url):
    """1ページ分の JSON と、総数ヘッダー X-WP-Total（無ければ None）。
    取得・再試行・キャッシュよけは全ビルダー共通の bm_build.fetch_response。"""
    data, headers = bm_build.fetch_response(url)
    return data, headers.get("x-wp-total")


def fetch_all_pages(api, *, label):
    """per_page 件ちょうど返ったら次のページ（&page=2, 3…）を取り、全件を返す。
    途中の失敗・不完全（前のページと同じ記事が返る＝API がページ送りを無視している、総数ヘッダーと合わない、
    ページが多すぎる）は ValueError 等で止める。呼び出し側は何も書き出さず、古いページも消さない。"""
    records, seen, total = [], set(), None
    for page in range(1, MAX_PAGES + 1):
        batch, header = fetch_page(api if page == 1 else f"{api}&page={page}")
        if header is not None and str(header).strip().isdigit():
            total = int(header)
        require_records(batch, label=f"{label} page {page}", allow_empty=page > 1)
        ids = {str(item["id"]) for item in batch}
        if seen & ids:
            raise ValueError(f"{label}: page {page} repeats earlier articles; the API ignores pagination, "
                             "so the list may be cut off")
        seen |= ids
        records += batch
        if len(batch) < COLUMNS_PER_PAGE:
            if total is not None and total != len(records):
                raise ValueError(f"{label}: got {len(records)} articles but X-WP-Total is {total}")
            return records
    raise ValueError(f"{label}: more than {MAX_PAGES} pages")


def fetch_columns():
    """BizManga に載せるコラムの全件（WP の並び＝公開日の新しい順）。build-columns.py と build-feed.py の共通入口。
    0件・ID 欠落・重複・取得の途中失敗・不完全な一覧では例外にする（既存のページを消さないため）。"""
    columns = fetch_all_pages(COLUMNS_API, label="columns")
    # 掲載先で絞る前の一覧も最後のページまで取れること（取れなければ、絞る前に切られた記事があり得る）
    fetch_all_pages(COLUMNS_ALL_SITES_API, label="columns (all sites)")
    return columns


# ── 日付 ── 実行時刻（ランナーの時計・タイムゾーン）には依存しない。同じ WP データなら同じ出力
def ymd(value) -> str:
    """WP の日付（YYYY-MM-DD。ニュース・コラムの date は YYYY.MM.DD）を YYYY-MM-DD に。読めなければ ""。"""
    match = re.fullmatch(r"(\d{4})[-./](\d{1,2})[-./](\d{1,2})", str(value or "").strip())
    try:
        return datetime.date(*map(int, match.groups())).isoformat() if match else ""
    except ValueError:
        return ""


def published_ymd(post) -> str:
    """公開日（YYYY-MM-DD）。読めなければ ""。"""
    return ymd(post.get("date_ymd")) or ymd(post.get("date"))


def updated_ymd(post) -> str:
    """記事が最後に変わった日（YYYY-MM-DD）＝公開日と WP の更新日の新しい方。読めなければ ""。
    コラムの詳細ページの dateModified、sitemap の lastmod、フィードの並びと lastBuildDate はすべてこれを使う。
    予約投稿は WP の更新日が公開日より前になるので、そのときは公開日（更新日が公開日より前にならない）。"""
    return max(published_ymd(post), ymd(post.get("modified_ymd")))


# ── 文字の正規化 ── ページ（一覧・特集枠・ホーム枠・詳細）とフィードで同じ
def normalize_brand_text(text, *, prices=True):
    """ブランド方針に沿ってWP由来テキストを正規化する（冪等）。
    - AI混在比率表現（「人間7割×AI3割」「ハイブリッド制作」等）→「独自の制作メソッド」
      （方針: 比率系コピー禁止。memory feedback_no_ai_ratio_copy）
    - 旧料金コピー → 現行基本料金25,740円〜（税抜・原稿料別途）
    WP本文がマスターのままでも、ビルド時に公開HTMLを方針準拠へ正規化する。
    コラムのページ（tools/build-columns.py）とフィード（tools/bm_feed.py）で同じものを使う。
    """
    if not text:
        return text
    text = re.sub(r'「人間7割[×xX]AI3割」のハイブリッド制作体制', '独自の制作メソッド', text)
    text = re.sub(r'「人間7割[×xX]AI3割」のハイブリッド制作', '独自の制作メソッド', text)
    text = re.sub(r'「人間7割[×xX]AI3割」のハイブリッド', '独自の制作メソッド', text)
    text = re.sub(r'「人間7割[×xX]AI3割」の体制', '独自の制作メソッド', text)
    text = re.sub(r'「人間7割[×xX]AI3割」', '独自の制作メソッド', text)
    text = re.sub(r'人間7割[×xX]AI3割のハイブリッド制作体制', '独自の制作メソッド', text)
    text = re.sub(r'人間7割[×xX]AI3割のハイブリッド制作', '独自の制作メソッド', text)
    text = re.sub(r'人間7割[×xX]AI3割のハイブリッド', '独自の制作メソッド', text)
    text = re.sub(r'人間7割[×xX]AI3割の体制', '独自の制作メソッド', text)
    text = re.sub(r'人間7割[×xX]AI3割', '独自の制作メソッド', text)
    text = re.sub(r'7割人間・3割AI', '独自の制作メソッド', text)
    text = re.sub(r'人の手7割[×xX]AI3割のハイブリッド制作', '独自の制作メソッド', text)
    text = re.sub(r'人の手7割[×xX]AI3割', '独自の制作メソッド', text)
    return normalize_price_text(text) if prices else text
