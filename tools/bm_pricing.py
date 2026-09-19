"""BizMangaの旧料金コピーを現行料金へ揃える（サイト側のみ）。

本文の文字列だけを処理し、URL・画像・作品IDは変更しない。
同じ置換定義からブラウザー用 js/bm-pricing.js を生成する。
"""
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_COPY = "1ページ25,740円〜（税抜・原稿料別途）"

# 長い旧料金説明を先に置換。価格以外の本文や比較対象の相場は維持する。
REPLACEMENTS = [
    # WP原稿には静的HTMLより古い14,700円表記もある。先に表記を揃え、
    # 下の説明文・総額例の修正を同じように適用する。
    ("14,700円", "16,600円"),
    ("14700円", "16,600円"),
    ("16600円", "16,600円"),
    ("11,300円", "16,600円"),
    ("1ページあたり16,600円から（5本セットでの単価）、1本のみの場合は19,800円", BASE_COPY),
    ("1ページあたり16,600円〜（5本セット時）から漫画制作が可能です。3本セットなら17,900円/ページ、1本なら19,800円/ページです。", BASE_COPY + "で漫画制作が可能です。本数割引の詳細は料金ページをご確認ください。"),
    ("1本単独発注では1ページ単価19,800円から、5本セットで16,600円/Pまで下がります。10ページ・3本セットの実勢価格は約19.8万円〜", "基本料金は" + BASE_COPY + "です。10ページを1本制作する場合の目安は原稿料込み283,140円（税抜）"),
    ("ページ単価は5本セットで16,600円から、3本セットは17,900円、1本は19,800円で、別途、原稿料が19,800円かかります。", "基本料金は" + BASE_COPY + "です。本数割引の詳細は料金ページをご確認ください。"),
    ("1ページ16,600円〜（5本セット時）という水準です（3本セットは17,900円、単発は19,800円）。", BASE_COPY + "という水準です。本数割引の詳細は料金ページをご確認ください。"),
    ("ページ単価は5本セットで16,600円から、単品なら19,800円（別途、原稿料が1本あたり19,800円）", "基本料金は" + BASE_COPY),
    ("1ページあたり16,600円（5本セット時）から提供しています。本数の組み合わせ別の単価は次の通りです。1本単発の場合は1ページ19,800円、3本セットでは1ページ17,900円、5本セットでは1ページ16,600円となります。これとは別に、原稿料として一本あたり19,800円が必要です。10ページの漫画を5本セットで制作する場合、約18.5万円から制作可能です。", BASE_COPY + "で提供しています。基本料金で10ページの漫画を1本制作する場合、原稿料込み283,140円（税抜）が目安です。本数割引の詳細は料金ページをご確認ください。"),
    ("1ページ16,600円〜という価格帯で提供しています（5本セット時の単価。10ページで約18.5万円〜）。", BASE_COPY + "で提供しています。基本料金で10ページを1本制作する場合、原稿料込み283,140円（税抜）が目安です。"),
    ("一本あたり原稿料19,800円をいただく形にしています。ページ単価は5本セットで16,600円/P、3本セットで17,900円/P、1本で19,800円/P", "1本ごとに適用ページ単価と同額の原稿料（税抜）をいただく形にしています。基本料金は" + BASE_COPY),
    ("3本セットで17,900円/P、5本セットで16,600円/P", "ハイブリッドプランは3本セットで23,200円/P、5本以上で21,600円/P（いずれも税抜・原稿料別途）"),
    ("5本セットで1ページ16,600円から、最短2週間で制作できます。3本セットなら17,900円、1本のみの場合は19,800円が目安です。", BASE_COPY + "、最短2週間で制作できます。本数割引の詳細は料金ページをご確認ください。"),
    ("当社の単価は、5本セットで1ページ16,600円、3本セットで17,900円、1本のみで19,800円です。これに1本あたり19,800円の原稿料が加わります。5本セットで10ページを制作する場合は約18.5万円から", "当社の基本料金は" + BASE_COPY + "です。基本料金で10ページを1本制作する場合は原稿料込み283,140円（税抜）が目安"),
    ("1ページ16,600円〜（5本セット時）。3本セットは17,900円／ページ、1本は19,800円／ページ。別途、原稿料が一本あたり19,800円", BASE_COPY + "。本数割引は料金ページを参照"),
    ("1ページあたり16,600円〜（5本セット時／1本単独なら19,800円／P）", BASE_COPY),
    ("1ページ16,600円〜（5本セット時）、3本なら17,900円、単発は19,800円", BASE_COPY),
    ("1ページ16,600円〜（5本セット時）、単発は19,800円", BASE_COPY),
    ("1ページ単価は19,800円（1本）／17,900円（3本セット）／16,600円（5本セット）で、10ページ・5本セット時の総額は約18.5万円から", "基本料金は" + BASE_COPY + "で、10ページを1本制作する場合の総額は原稿料込み283,140円（税抜）が目安です"),
    ("1本からの発注は1ページ19,800円、3本セットで17,900円、5本セットで16,600円と、本数に応じて単価が下がる料金体系", "基本料金は" + BASE_COPY + "で、本数割引もある料金体系"),
    ("5本セットで1ページあたり16,600円からが最安単価となります", "基本料金は" + BASE_COPY + "です"),
    ("1ページ16,600円から（5本セット時。3本セットは17,900円、1本のみは19,800円）", BASE_COPY),
    ("ページ単価は1本あたり19,800円からで、まとめて発注するほど下がります。公式推奨の3本セットなら17,900円、5本セットなら16,600円が単価の目安です（別途、原稿料が1本あたり19,800円かかります）。", "基本料金は" + BASE_COPY + "です。ハイブリッドプランには本数割引があり、3本セットは23,200円/P、5本以上は21,600円/P（いずれも税抜・原稿料別途）です。"),
    ("5本セットの場合1ページあたり", "1ページあたり"),
    ("5本セット時1ページ16,600円", "基本料金1ページ25,740円"),
    ("1ページあたりの単価は5本セット時で", "基本料金は1ページあたり"),
    ("5本セット16,600円/P〜", "基本料金25,740円/P〜"),
    ("16,600円〜（5本セットの場合）", "25,740円〜（税抜・原稿料別途）"),
    ("16,600円〜（5本セット時）", "25,740円〜（税抜・原稿料別途）"),
    ("16,600円〜(5本セット時)", "25,740円〜（税抜・原稿料別途）"),
    ("16,600円（5本セット時）", "25,740円（税抜・原稿料別途）"),
    ("16,600円〜・5本セット時", "25,740円〜・税抜"),
    # 旧3段階の料金表。文字を連結して照合するため、tdを跨いでも更新できる。
    ("3本セット17,900円", "3本セット23,200円（税抜）"),
    ("5本セット16,600円", "5本セット21,600円（税抜）"),
    ("1本19,800円", "1本25,740円（税抜）"),
    ("原稿料（一本あたり19,800円）", "原稿料（1本ごとに適用ページ単価と同額・税抜）"),
    ("原稿料（1本あたり19,800円）", "原稿料（1本ごとに適用ページ単価と同額・税抜）"),
    ("原稿料が1本あたり19,800円かかります", "原稿料が1本ごとに適用ページ単価と同額（税抜）かかります"),
    ("原稿料19,800円/本", "原稿料は別途（1本ごとに適用ページ単価と同額・税抜）"),
    ("セット発注なら1本あたり約18.5万円〜", "基本料金で10ページを1本制作する場合は約28.3万円（税抜・原稿料込み）〜"),
    ("20ページを全面漫画化すると、ページ単価16,600円換算でも29万円超になります。これに対し、要所4ページの漫画化なら約60,000円から始められます。", "基本料金1ページ25,740円で20ページを全面漫画化すると、原稿料込み540,540円（税抜）が目安です。これに対し、要所4ページの漫画化なら原稿料込み128,700円（税抜）が目安です。"),
    ("10万円以下の試行予算で4ページの漫画を制作", "原稿料込み128,700円（税抜）を目安に4ページの漫画を制作"),
    ("初回4ページのPoC費用：約60,000円", "初回4ページのPoC費用：原稿料込み128,700円（税抜）"),
    ("商談中の集中力維持／要点の記憶定着約60,000円〜（4ページ）", "商談中の集中力維持／要点の記憶定着128,700円〜（4ページ・税抜・原稿料込み）"),
    ("商談前の事前理解／会社理解の促進約220,000円〜（15ページ）", "商談前の事前理解／会社理解の促進411,840円〜（15ページ・税抜・原稿料込み）"),
    ("商談中の関心喚起約16,600円〜（1ページ）", "商談中の関心喚起51,480円〜（1ページ・税抜・原稿料込み）"),
    ("商談中の関心喚起約25,740円〜（1ページ）", "商談中の関心喚起51,480円〜（1ページ・税抜・原稿料込み）"),
    ("初期費用の目安約220,000円〜", "初期費用の目安411,840円〜（15ページ・税抜・原稿料込み）"),
    ("411,840円〜（15ページ・税抜・原稿料込み）約60,000円〜", "411,840円〜（15ページ・税抜・原稿料込み）128,700円〜（4ページ・税抜・原稿料込み）"),
    ("合計10ページで147,000円〜という単価感です", "合計10ページの作画料は257,400円（税抜）で、別途、制作本数に応じた原稿料がかかります"),
    ("約18.5万円", "約28.3万円（税抜・原稿料込み）"),
    ("18.5万円", "28.3万円（税抜・原稿料込み）"),
    ("16,600円（税込）", "25,740円（税抜・原稿料別途）"),
    ("1ページ16,600円〜", BASE_COPY),
    ("1ページあたり16,600円〜", BASE_COPY),
    ("1ページあたり16,600円から", "1ページあたり25,740円〜（税抜・原稿料別途）"),
    ("ビズマンガ16,600円〜", "ビズマンガ25,740円〜（税抜・原稿料別途）"),
    ("16,600円", "25,740円"),
    ("19,800円", "25,740円"),
]


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
        replacement = new[prefix:len(new) - suffix if suffix else None]
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
    script = '''/* Generated by tools/bm_pricing.py. Edit its REPLACEMENTS, then regenerate. */
(function () {
  'use strict';
  var rules = __RULES__;
  function positions(source, old) {
    var result = [], index = source.indexOf(old), startsNumber = /^[0-9]/.test(old);
    while (index !== -1) {
      if (!startsNumber || index === 0 || !/[0-9,.]/.test(source[index - 1])) result.push(index);
      index = source.indexOf(old, index + old.length);
    }
    return result;
  }
  function text(value) {
    if (typeof value !== 'string') return value;
    rules.forEach(function (rule) {
      positions(value, rule[0]).reverse().forEach(function (start) {
        value = value.slice(0, start) + rule[1] + value.slice(start + rule[0].length);
      });
    });
    return value;
  }
  function html(value) {
    if (!value) return value;
    var template = document.createElement('template');
    template.innerHTML = value;
    var walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    var nodes = [], node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement || !node.parentElement.closest('script, style')) nodes.push(node);
    }
    rules.forEach(function (rule) {
      var source = nodes.map(function (n) { return n.nodeValue; }).join('');
      var prefix = 0, suffix = 0;
      while (prefix < Math.min(rule[0].length, rule[1].length) && rule[0][prefix] === rule[1][prefix]) prefix++;
      while (suffix < Math.min(rule[0].length, rule[1].length) - prefix &&
        rule[0][rule[0].length - suffix - 1] === rule[1][rule[1].length - suffix - 1]) suffix++;
      var replacement = rule[1].slice(prefix, suffix ? -suffix : undefined);
      positions(source, rule[0]).reverse().forEach(function (start) {
        var end = start + rule[0].length - suffix, offset = 0;
        start += prefix;
        nodes.forEach(function (n) {
          var part = n.nodeValue, right = offset + part.length;
          if (offset < end && right > start) {
            var a = Math.max(0, start - offset), b = Math.min(part.length, end - offset);
            n.nodeValue = part.slice(0, a) + (offset <= start ? replacement : '') + part.slice(b);
          }
          offset = right;
        });
      });
    });
    return template.innerHTML;
  }
  function post(value) {
    if (Array.isArray(value)) return value.map(post);
    if (!value || typeof value !== 'object') return value;
    var result = Object.assign({}, value);
    ['title_ja', 'excerpt_ja'].forEach(function (key) {
      if (typeof result[key] === 'string') result[key] = text(result[key]);
    });
    if (typeof result.content === 'string') result.content = html(result.content);
    return result;
  }
  window.bmPricing = { text: text, html: html, post: post };
})();
'''.replace('__RULES__', rules)
    path = ROOT / 'js/bm-pricing.js'
    if not path.exists() or path.read_text(encoding='utf-8') != script:
        path.write_text(script, encoding='utf-8')


if __name__ == '__main__':
    write_browser_script()
