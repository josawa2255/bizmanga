"""RSS 2.0 フィード（/feed.xml）。Googlebot / Bingbot / Feedly 等のクローラの発見に使う。

コラムのビルド（tools/build-columns.py）が、ページを書き終えた後に**同じ取得データ**（bm_content.fetch_columns の結果）で
write_feed() を呼ぶ（ニュースはここで取る）。手動で作り直すときは tools/build-feed.py（同じ関数）。

出力は WP のデータだけで決まり、実行時刻に依存しない（記事が変わらなければ feed.xml はバイト単位で同じ）。
- 並び: 記事が最後に変わった日（bm_content.updated_ymd。詳細ページの dateModified・sitemap の lastmod と同じ）の
  新しい順に最大30件（同じ日は API の並び順のまま）
- lastBuildDate: 載せる記事の最新の日付の 00:00 JST（その日のビルドより未来にならない）。日付が無ければ出さない
- pubDate: 公開日の 09:00 JST（従来どおり）。日付が無ければ出さない（実行時刻で埋めない）
- コラム: リンクはページと同じ slug の /column/{slug}。タイトル・抜粋はページと同じ正規化（料金＋ブランド表現）
- ニュース: リンクはサイトと同じ規則（js/bm-wp-api.js の loadNews）。url があればそれ（http(s) か相対。javascript: 等は不可）、
  無ければ has_detail と id で /news-detail?id=、どちらも無ければ /news。カテゴリは tag_ja、無ければ「ニュース」
- 抜粋が無ければ定型文。XML で使えない制御文字はタイトル・抜粋・カテゴリから取り除く
"""
import datetime
from email.utils import format_datetime
from pathlib import Path
import re
import sys
from urllib.parse import quote, urljoin, urlsplit
from xml.sax.saxutils import escape as xml_escape, quoteattr

import bm_build
from bm_build import API_BASE, SITE_URL, require_records, write_text
from bm_content import make_slug, normalize_brand_text, updated_ymd, ymd
from bm_html import site_url

SITE_NAME = "ビズマンガ"
FEED_NAME = "feed.xml"
MAX_ITEMS = 30
NEWS_API = f"{API_BASE}/news?site=bizmanga&per_page=20"
JST = datetime.timezone(datetime.timedelta(hours=9))
EXCERPT_FALLBACK = {
    "column": "ビジネス漫画制作の詳細記事はサイトでご覧ください。",
    "news": "ビズマンガからのお知らせです。詳細はサイトでご覧ください。",
}
# XML 1.0 で使えない文字（タブ・改行以外の制御文字、サロゲート、U+FFFE/U+FFFF）
_NOT_XML_CHAR = re.compile("[^\t\n\r\x20-\ud7ff\ue000-\ufffd\U00010000-\U0010ffff]")


def fetch_json(url, timeout=30):
    return bm_build.fetch_json(url, timeout=timeout, user_agent="BizManga-FeedBot/1.0")


def xml_text(value) -> str:
    """WP 由来の文字を XML の本文に入れられる形にする（使えない制御文字を除いてエスケープ）"""
    return xml_escape(_NOT_XML_CHAR.sub("", str(value or "")).strip())


def rfc822(value, hour=9) -> str:
    """日付を RFC 822 形式（RSS仕様準拠、JST）に変換。読めない日付は ""（実行時刻で埋めない）"""
    day = ymd(value)
    if not day:
        return ""
    return format_datetime(datetime.datetime.fromisoformat(day).replace(hour=hour, tzinfo=JST))


def published_date(post) -> str:
    return ymd(post.get("date_ymd")) or ymd(post.get("date")) or ymd(post.get("modified_ymd"))


def _link_url(value) -> str:
    """ニュースの url の検査: http(s) の絶対 URL か、サイト内の相対 URL（絶対 URL にする）。それ以外は ""。"""
    s = str(value or "").strip()
    if not s or re.search(r"[\x00-\x20\x7f\\]", s) or s.startswith("//"):
        return ""
    if re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", s):
        parts = urlsplit(s)
        return s if parts.scheme.lower() in ("http", "https") and parts.netloc else ""
    return urljoin(SITE_URL + "/", s)


def news_url(post) -> str:
    """サイトのニュース一覧（js/bm-wp-api.js の loadNews）と同じリンク先"""
    link = _link_url(post.get("url"))
    if link:
        return link
    if post.get("has_detail") and post.get("id"):
        # encodeURIComponent と同じ（英数字と -_.!~*'() 以外をエンコード）
        return f"{SITE_URL}/news-detail?id=" + quote(str(post["id"]), safe="!'()*")
    return f"{SITE_URL}/news"


def build_item(post, kind):
    """1 item の XML。要素を集めて join する（省いた要素の空行を残さない）"""
    if kind == "column":
        url = f"{SITE_URL}/column/{make_slug(post)}"
        title = normalize_brand_text(post.get("title_ja") or "")
        excerpt = normalize_brand_text(post.get("excerpt_ja") or "")
        category = post.get("category") or "コラム"
    else:
        url = news_url(post)
        title = post.get("title_ja") or ""
        excerpt = post.get("excerpt_ja") or ""
        category = post.get("tag_ja") or "ニュース"
    excerpt = xml_text(excerpt) or xml_escape(EXCERPT_FALLBACK[kind])
    pub_date = rfc822(published_date(post))
    thumbnail = site_url(post.get("thumbnail"))
    lines = [
        f"<title>{xml_text(title)}</title>",
        f"<link>{xml_escape(url)}</link>",
        f'<guid isPermaLink="true">{xml_escape(url)}</guid>',
        *([f"<pubDate>{pub_date}</pubDate>"] if pub_date else []),
        f"<category>{xml_text(category)}</category>",
        f"<description>{excerpt}</description>",
        *([f'<enclosure url={quoteattr(urljoin(SITE_URL + "/", thumbnail))} type="image/webp" />'] if thumbnail else []),
    ]
    return "    <item>\n" + "".join(f"      {line}\n" for line in lines) + "    </item>"


def render_feed(columns, news_items):
    """記事一覧から feed.xml の内容を作る（同じ入力なら常に同じ出力）。(XML, 件数)"""
    # 最後に変わった日の新しい順（同じ日は API の並び順のまま）
    all_items = [("column", c, updated_ymd(c)) for c in columns]
    all_items += [("news", n, updated_ymd(n)) for n in news_items]
    all_items.sort(key=lambda x: x[2], reverse=True)
    all_items = all_items[:MAX_ITEMS]

    # 先頭が最新。その日の 00:00 JST（ビルドした日より未来にならない）。日付の読める記事が無ければ出さない（RSS では任意）
    last_build = rfc822(all_items[0][2], hour=0) if all_items else ""
    channel = [
        f"<title>{SITE_NAME} コラム・ニュース</title>",
        f"<link>{SITE_URL}/</link>",
        f"<description>ビジネス漫画制作の{SITE_NAME}が発信する、採用・営業・研修・BtoBマーケなどのマンガ活用ノウハウ・事例・業界動向。</description>",
        "<language>ja</language>",
        "<copyright>© Contents X 株式会社</copyright>",
        *([f"<lastBuildDate>{last_build}</lastBuildDate>"] if last_build else []),
        f'<atom:link href="{SITE_URL}/{FEED_NAME}" rel="self" type="application/rss+xml" />',
        "<image>",
        "  <url>https://contentsx.jp/material/images/logo/bizmanga-logo.webp</url>",
        f"  <title>{SITE_NAME}</title>",
        f"  <link>{SITE_URL}/</link>",
        "</image>",
    ]
    rss_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
        "  <channel>\n"
        + "".join(f"    {line}\n" for line in channel)
        + "".join(build_item(post, kind) + "\n" for kind, post, _ in all_items)
        + "  </channel>\n"
        "</rss>\n"
    )
    return rss_xml, len(all_items)


def fetch_news():
    """ニュース。取れなければ [] にして（フィードはコラムだけで作る）、Actions の画面に警告を出す"""
    try:
        news = require_records(fetch_json(NEWS_API), label="news", allow_empty=True)
    except Exception as e:
        print(f"::warning::feed: news fetch failed; building the feed from columns only: {e}", file=sys.stderr)
        return []
    print(f"ニュース: {len(news)}件取得")
    return news


def write_feed(columns, root):
    """columns（bm_content.fetch_columns の結果）と、ここで取るニュースから root/feed.xml を書く。書いた件数を返す。
    XML として読めない内容は書かない（bm_build.write_text が検査する。既存の feed.xml は残る）"""
    rss_xml, count = render_feed(columns, fetch_news())
    write_text(Path(root) / FEED_NAME, rss_xml)
    return count
