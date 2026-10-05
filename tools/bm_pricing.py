"""BizMangaの旧料金コピーを現行料金へ揃える（サイト側のみ）。

本文の文字列だけを処理し、URL・画像・作品IDは変更しない。
同じ置換定義からブラウザー用 js/bm-pricing.js を生成する。
"""

import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from bm_build import write_text

ROOT = Path(__file__).resolve().parents[1]
from bm_pricing_rules import REPLACEMENTS


def _price_pattern(old):
    # 116,600円など、別の金額の末尾だけを置換しない。
    return (r'(?<![0-9,.])' if old[0].isdigit() else '') + re.escape(old)


def normalize_price_text(value):
    if not isinstance(value, str):
        return value
    for old, new in REPLACEMENTS:
        value = re.sub(_price_pattern(old), lambda match: new, value)
    return value


def _replace_parts(parts):
    """タグを残し、複数テキストノードに跨る料金説明を更新する。"""
    for old, new in REPLACEMENTS:
        text = ''.join(parts)
        matches = list(re.finditer(_price_pattern(old), text))
        prefix = 0
        while prefix < min(len(old), len(new)) and old[prefix] == new[prefix]:
            prefix += 1
        suffix = 0
        while suffix < min(len(old), len(new)) - prefix and old[-suffix - 1] == new[-suffix - 1]:
            suffix += 1
        replacement = new[prefix : len(new) - suffix if suffix else None]
        for match in reversed(matches):
            start, end = match.span()
            start += prefix
            end -= suffix
            offset = 0
            for i, part in enumerate(parts):
                right = offset + len(part)
                if offset < end and right > start:
                    a, b = max(0, start - offset), min(len(part), end - offset)
                    parts[i] = part[:a] + (replacement if offset <= start else '') + part[b:]
                offset = right
    return parts


class _PriceHTML(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.lines = [0]
        self.lines.extend(m.end() for m in re.finditer('\n', source))
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)

    def _record(self, raw, text):
        if not self.skip:
            line, column = self.getpos()
            start = self.lines[line - 1] + column
            self.parts.append((start, start + len(raw), text))

    def handle_data(self, data):
        self._record(data, data)

    def handle_entityref(self, name):
        raw = '&' + name + ';'
        self._record(raw, html.unescape(raw))

    def handle_charref(self, name):
        raw = '&#' + name + ';'
        self._record(raw, html.unescape(raw))

    def result(self):
        texts = _replace_parts([part[2] for part in self.parts])
        output = self.source
        for (start, end, old), new in reversed(list(zip(self.parts, texts))):
            if old != new:
                output = output[:start] + html.escape(new, quote=False) + output[end:]
        return output


def normalize_price_html(value):
    if not value:
        return value
    parser = _PriceHTML(value)
    parser.feed(value)
    parser.close()
    return parser.result()


def write_browser_script():
    """Pythonとブラウザーで同じ料金修正を使う。列挙順も保持する。"""
    rules = json.dumps(REPLACEMENTS, ensure_ascii=False, indent=2)
    script = (
        (ROOT / 'tools/templates/bm-pricing.js.tpl')
        .read_text(encoding='utf-8')
        .replace('__RULES__', rules)
    )
    path = ROOT / 'js/bm-pricing.js'
    if not path.exists() or path.read_text(encoding='utf-8') != script:
        write_text(path, script)


if __name__ == '__main__':
    write_browser_script()
