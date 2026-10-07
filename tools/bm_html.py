"""Allowlist sanitizer for WordPress article HTML."""

import html
import re
from html.parser import HTMLParser

# ── WP本文HTMLのallowlistサニタイズ（標準ライブラリのみ。bleach等の追加依存なし）──
# WP管理画面が侵害された場合の持続的XSS（SPEC §15.1 S1）対策。
# 許可タグ・許可属性以外は除去し、危険なタグは中身ごと捨てる。
_ALLOWED_TAGS = {
    "p",
    "br",
    "hr",
    "h2",
    "h3",
    "h4",
    "h5",
    "blockquote",
    "ul",
    "ol",
    "li",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "small",
    "mark",
    "sub",
    "sup",
    "a",
    "img",
    "figure",
    "figcaption",
    "span",
    "div",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "code",
    "pre",
}
# 中身ごと完全に破棄するタグ
_VOID_DROP_TAGS = {
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "form",
    "noscript",
    "template",
    "svg",
    "math",
    "link",
    "meta",
    "base",
}
_SELF_CLOSING = {"br", "hr", "img"}
_VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}
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
        if image and re.match(
            r"^data:image/(?:png|gif|jpeg|webp|avif|bmp|x-icon);base64,[a-zA-Z0-9+/=]+$", v, re.I
        ):
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


def sanitize_html(raw):
    """WP本文HTMLを allowlist でサニタイズした文字列を返す。"""
    parser = _Sanitizer()
    parser.feed(raw)
    parser.close()
    return "".join(parser.out)


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
                value = _safe_url(
                    value, link=tag == "a" and name == "href", image=tag == "img" and name == "src"
                )
                if value is None:
                    continue
            elif name == "srcset":
                value = _safe_srcset(value)
                if value is None:
                    continue
            kept.append((name, value or ""))
        attr_str = "".join(f' {n}="{html.escape(val, quote=True)}"' for n, val in kept)
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
