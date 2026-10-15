#!/usr/bin/env python3
"""BizManga RSS 2.0 フィード生成ツール
WP API から最新コラム + ニュースを取得し、/feed.xml を生成。
Googlebot / Bingbot / Feedly 等のクローラ発見に活用。

出力は WP のデータだけで決まり、実行時刻に依存しない（記事が変わらなければ feed.xml は
バイト単位で同じ＝日次ビルドで空のコミットを作らない）。lastBuildDate は RSS の
「チャンネルの内容が最後に変わった時刻」なので、載せる記事の最新の日付（公開日・更新日）にする。
コラムは build-columns.py と同じ一覧（bm_content.COLUMNS_API）・同じ slug から /column/{slug} を作る。

Usage:
  python3 tools/build-feed.py
"""
from bm_build import API_BASE, SITE_URL
from bm_build import fetch_json as _fetch_json, output_batch, require_records, write_text
import datetime
from email.utils import format_datetime
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape, quoteattr
from bm_content import COLUMNS_API, make_slug
from bm_pricing import normalize_price_text

SITE_NAME = "ビズマンガ"
ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "feed.xml"
MAX_ITEMS = 30
JST = datetime.timezone(datetime.timedelta(hours=9))


def fetch_json(url, timeout=30):
    return _fetch_json(url, timeout=timeout, user_agent="BizManga-FeedBot/1.0")


def ymd(value) -> str:
    """WP の日付（YYYY-MM-DD。ニュースは YYYY.MM.DD）を YYYY-MM-DD に。読めなければ ""。"""
    match = re.fullmatch(r"(\d{4})[-./](\d{1,2})[-./](\d{1,2})", str(value or "").strip())
    try:
        return datetime.date(*map(int, match.groups())).isoformat() if match else ""
    except ValueError:
        return ""


def rfc822(value) -> str:
    """日付を RFC 822 形式（RSS仕様準拠、09:00 JST）に変換。読めない日付は ""（実行時刻で埋めない）"""
    day = ymd(value)
    if not day:
        return ""
    return format_datetime(datetime.datetime.fromisoformat(day).replace(hour=9, tzinfo=JST))


def published_date(post) -> str:
    return ymd(post.get("date_ymd")) or ymd(post.get("date")) or ymd(post.get("modified_ymd"))


def changed_date(post) -> str:
    """記事が最後に変わった日（公開日と更新日の新しい方）。並び順と lastBuildDate に使う"""
    return max(ymd(post.get(key)) for key in ("date_ymd", "modified_ymd", "date"))


def build_item(post, kind):
    """1 item XML を構築"""
    slug = make_slug(post) if kind == "column" else ""
    title = post.get("title_ja", "").strip()
    excerpt = post.get("excerpt_ja", "").strip()
    if kind == "column":
        title = normalize_price_text(title)
        excerpt = normalize_price_text(excerpt)
    if not excerpt:
        excerpt = "ビジネス漫画制作の詳細記事はサイトでご覧ください。"
    pub_date = rfc822(published_date(post))
    thumbnail = post.get("thumbnail", "")
    category = post.get("category", "コラム")

    if kind == "column":
        url = f"{SITE_URL}/column/{slug}"
    elif kind == "news":
        url = f"{SITE_URL}/news-detail?id={post.get('id')}"
    else:
        url = SITE_URL

    return f"""    <item>
      <title>{xml_escape(title)}</title>
      <link>{xml_escape(url)}</link>
      <guid isPermaLink="true">{xml_escape(url)}</guid>
      {"<pubDate>" + pub_date + "</pubDate>" if pub_date else ""}
      <category>{xml_escape(category)}</category>
      <description>{xml_escape(excerpt)}</description>
      {'<enclosure url=' + quoteattr(thumbnail) + ' type="image/webp" />' if thumbnail else ''}
    </item>"""


def render_feed(columns, news_items):
    """記事一覧から feed.xml の内容を作る（同じ入力なら常に同じ出力）"""
    # 最後に変わった日の新しい順（同じ日は API の並び順のまま）
    all_items = [("column", c, changed_date(c)) for c in columns]
    all_items += [("news", n, changed_date(n)) for n in news_items]
    all_items.sort(key=lambda x: x[2], reverse=True)
    all_items = all_items[:MAX_ITEMS]

    # 先頭が最新。日付の読める記事が無いときは lastBuildDate を出さない（RSS では任意の要素）
    last_build = rfc822(all_items[0][2]) if all_items else ""
    last_build_xml = f"\n    <lastBuildDate>{last_build}</lastBuildDate>" if last_build else ""
    items_xml = "\n".join(build_item(post, kind) for kind, post, _ in all_items)

    rss_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>{SITE_NAME} コラム・ニュース</title>
    <link>{SITE_URL}/</link>
    <description>ビジネス漫画制作の{SITE_NAME}が発信する、採用・営業・研修・BtoBマーケなどのマンガ活用ノウハウ・事例・業界動向。</description>
    <language>ja</language>
    <copyright>© Contents X 株式会社</copyright>{last_build_xml}
    <atom:link href="{SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>https://contentsx.jp/material/images/logo/bizmanga-logo.webp</url>
      <title>{SITE_NAME}</title>
      <link>{SITE_URL}/</link>
    </image>
{items_xml}
  </channel>
</rss>
"""
    return rss_xml, len(all_items)


def _build():
    # コラム取得（build-columns.py と同じ一覧。0件・ID欠落なら書かずに失敗し、既存の feed.xml を残す）
    columns = require_records(fetch_json(COLUMNS_API), label="columns")
    print(f"コラム: {len(columns)}件取得")

    # ニュース取得（取れなければコラムだけで作る。Actions の画面に警告を出す）
    try:
        news_items = require_records(
            fetch_json(f"{API_BASE}/news?site=bizmanga&per_page=20"), label="news", allow_empty=True
        )
        print(f"ニュース: {len(news_items)}件取得")
    except Exception as e:
        print(f"::warning::feed: news fetch failed; building the feed from columns only: {e}", file=sys.stderr)
        news_items = []

    rss_xml, count = render_feed(columns, news_items)
    write_text(OUT_PATH, rss_xml)
    print(f"✓ {OUT_PATH.relative_to(ROOT)} 生成完了（{count}件）")


def main():
    with output_batch(ROOT):
        return _build()


if __name__ == "__main__":
    sys.exit(main() or 0)
