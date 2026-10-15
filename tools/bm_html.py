"""Allowlist sanitizer for WordPress article HTML, and the own-site URL check."""
import html
import re
from html.parser import HTMLParser

# ── 自サイト系URL（コラムのサムネイル等）。js/bm-sanitize.js の bmSanitize.url と同じ方針 ──
# 回帰ケースは tools/fixtures/site-urls.json（Python と JS の両方で同じ結果になることを test_build.py が確かめる）。
# String.prototype.trim が除く文字（JS と同じ前後の空白だけを落とす）
_JS_TRIM = "\t\n\v\f\r \xa0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a" \
           "\u2028\u2029\u202f\u205f\u3000\ufeff"
# スキーム付きは「http(s)://」＋書かれたままのホスト名が contentsx.jp かそのサブドメインのものだけ。
# ユーザー情報（user@）・%エンコード・全角などで、ブラウザが読むホスト名と食い違う書き方は通さない。
# re.ASCII: IGNORECASE の [a-z] に ſ や K（ケルビン記号）を含めない（JS の /i と同じにする）
_SITE_ABSOLUTE = re.compile(r"https?://(?:[a-z0-9-]+\.)*contentsx\.jp(?::[0-9]{1,5})?(?:[/?#]|$)",
                            re.IGNORECASE | re.ASCII)


def site_url(value):
    """相対URLか、contentsx.jp（とそのサブドメイン）の http(s) URL だけを返し、それ以外は ""。
    制御文字・空白・バックスラッシュ（ブラウザは \\ を / と読むので "/\\evil.example" が外部ドメインに化ける）と
    プロトコル相対（//host）は拒否する。"""
    s = str(value or "").strip(_JS_TRIM)
    if not s or re.search(r"[\x00-\x20\x7f\\]", s) or s.startswith("//"):
        return ""
    if re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", s) and not _SITE_ABSOLUTE.match(s):
        return ""
    return s


# ── WP本文HTMLのallowlistサニタイズ（標準ライブラリのみ。bleach等の追加依存なし）──
# WP管理画面が侵害された場合の持続的XSS（SPEC §15.1 S1）対策。
# 許可タグ・許可属性以外は除去し、危険なタグは中身ごと捨てる。
_ALLOWED_TAGS = {
    "p", "br", "hr", "h2", "h3", "h4", "h5", "blockquote",
    "ul", "ol", "li", "strong", "b", "em", "i", "u", "s", "small", "mark", "sub", "sup",
    "a", "img", "figure", "figcaption", "span", "div",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "code", "pre",
}
# 中身ごと完全に破棄するタグ
_VOID_DROP_TAGS = {"script", "style", "iframe", "object", "embed", "form", "noscript",
                   "template", "svg", "math", "link", "meta", "base"}
_SELF_CLOSING = {"br", "hr", "img"}
_VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
_ALLOWED_ATTRS = {
    "a": {"href", "title", "target", "rel"},
    "img": {"src", "alt", "width", "height", "loading", "decoding", "srcset", "sizes"},
    "td": {"colspan", "rowspan", "data-align"},
    "th": {"colspan", "rowspan", "data-align", "scope"},
    "*": {"class", "id"},
}


def _safe_url(value, *, link=False, image=False):
    """記事用URL。相対・http(s)、リンクのmailto/tel、画像のdataだけを許可。"""
    v = value or ""
    # ブラウザーがURL解釈時に除去するC0制御文字を、stripより先に拒否する。
    if re.search(r"[\x00-\x1f\x7f]", v):
        return None
    v = v.strip()
    scheme = re.match(r"^([a-zA-Z][a-zA-Z0-9+.-]*):", v)
    if scheme:
        protocol = scheme[1].lower()
        if protocol in {"http", "https"} or (link and protocol in {"mailto", "tel"}):
            return v
        if image and re.match(r"^data:image/(?:png|gif|jpeg|webp|avif|bmp|x-icon);base64,[a-zA-Z0-9+/=]+$", v, re.I):
            return v
        return None
    return v


def _safe_srcset(value):
    """srcsetの各URLを検証。data URLはカンマ区切りと曖昧になるため許可しない。"""
    if not value:
        return None
    if re.search(r"[\x00-\x1f\x7f]", value):
        return None
    parts = []
    for chunk in value.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        url = chunk.split()[0]
        if _safe_url(url) is None:
            return None
        parts.append(chunk)
    return ", ".join(parts) if parts else None


class _Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self._skip_depth = 0  # script等のネスト深さ

    def handle_starttag(self, tag, attrs):
        if tag in _VOID_DROP_TAGS:
            if tag not in _VOID_TAGS:
                self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if tag not in _ALLOWED_TAGS:
            return  # 不許可タグは要素を落とす（中身テキストは残る）
        allowed = _ALLOWED_ATTRS.get(tag, set()) | _ALLOWED_ATTRS["*"]
        kept = []
        for name, value in attrs:
            name = (name or "").lower()
            if name.startswith("on"):  # onclick 等のイベントハンドラ
                continue
            if name not in allowed:
                continue
            if name in ("href", "src"):
                value = _safe_url(value, link=tag == "a" and name == "href",
                                  image=tag == "img" and name == "src")
                if value is None:
                    continue
            elif name == "srcset":
                value = _safe_srcset(value)
                if value is None:
                    continue
            kept.append((name, value or ""))
        attr_str = "".join(
            f' {n}="{html.escape(val, quote=True)}"' for n, val in kept
        )
        if tag == "a" and not any(n == "rel" for n, _ in kept):
            attr_str += ' rel="noopener"'
        slash = "/" if tag in _SELF_CLOSING else ""
        self.out.append(f"<{tag}{attr_str}{slash}>")

    def handle_endtag(self, tag):
        if tag in _VOID_DROP_TAGS and tag not in _VOID_TAGS:
            if self._skip_depth:
                self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if tag in _ALLOWED_TAGS and tag not in _SELF_CLOSING:
            self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if self._skip_depth:
            return
        self.out.append(html.escape(data, quote=False))
