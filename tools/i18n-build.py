#!/usr/bin/env python3
"""
BizManga i18n Build Tool
========================
HTMLファイルとJSファイルから日本語テキストを抽出し、
en.json 翻訳辞書を自動更新するビルドスクリプト。

機能:
  1. HTML の data-ja/data-en 属性ペアを抽出
  2. HTML のテキストノードから日本語テキストを抽出
  3. JS ファイルから日本語文字列リテラルを抽出
  4. 既存の en.json と統合（既存翻訳を保持）
  5. 未翻訳のキーをレポート
  6. --auto-translate: Google翻訳API（無料）で未翻訳を自動補完

使い方:
  python tools/i18n-build.py                    # 抽出・統合のみ
  python tools/i18n-build.py --auto-translate   # 自動翻訳も実行
  python tools/i18n-build.py --dry-run          # 変更せず差分表示
  python tools/i18n-build.py --report           # 未翻訳レポートのみ
"""

import json
import os
import re
import sys
import glob
import argparse
import time
from html.parser import HTMLParser

# ============================================================
# 設定
# ============================================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)  # BizManga/
EN_JSON_PATH = os.path.join(BASE_DIR, 'i18n', 'en.json')
HTML_DIR = BASE_DIR
JS_DIR = os.path.join(BASE_DIR, 'js')

# 日本語検出パターン
JA_PATTERN = re.compile(r'[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]')

# 翻訳不要なテキスト（短すぎる、記号のみなど）
SKIP_TEXTS = {
    '', '×', '〜', '→', '←', '↓', '↑', '・', '…', '。', '、',
    '©', '®', '™', '/', '|', '-', '—', '＝', '＞', '＜'
}

# スキップするHTMLタグ
SKIP_TAGS = {'script', 'style', 'noscript', 'code', 'pre', 'svg'}


# ============================================================
# HTML テキスト抽出
# ============================================================
class JapaneseTextExtractor(HTMLParser):
    """HTMLから日本語テキストとdata-ja/data-en属性を抽出"""

    def __init__(self):
        super().__init__()
        self.translations = {}      # {ja: en} data-ja/data-en ペア
        self.japanese_texts = set()  # テキストノードの日本語
        self._skip_depth = 0
        self._current_tag = None
        self._skip_i18n = False

    def handle_starttag(self, tag, attrs):
        self._current_tag = tag
        attr_dict = dict(attrs)

        # スキップ対象タグ
        if tag in SKIP_TAGS:
            self._skip_depth += 1
            return

        # data-i18n-skip
        if 'data-i18n-skip' in attr_dict:
            self._skip_i18n = True
            return

        # data-ja / data-en ペア抽出
        if 'data-ja' in attr_dict and 'data-en' in attr_dict:
            ja = attr_dict['data-ja'].strip()
            en = attr_dict['data-en'].strip()
            if ja and en and has_japanese(ja):
                self.translations[ja] = en

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1
        self._skip_i18n = False

    def handle_data(self, data):
        if self._skip_depth > 0 or self._skip_i18n:
            return
        text = data.strip()
        if text and has_japanese(text) and text not in SKIP_TEXTS:
            # 改行・空白を正規化
            text = re.sub(r'\s+', ' ', text).strip()
            if len(text) >= 2:
                self.japanese_texts.add(text)


def has_japanese(text):
    """日本語文字が含まれるか判定"""
    return bool(JA_PATTERN.search(text))


def extract_from_html(html_path):
    """HTMLファイルから翻訳データを抽出"""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    parser = JapaneseTextExtractor()
    try:
        parser.feed(content)
    except Exception as e:
        print(f'  [WARN] HTML parse error in {os.path.basename(html_path)}: {e}')

    return parser.translations, parser.japanese_texts


# ============================================================
# JS テキスト抽出
# ============================================================
def extract_from_js(js_path):
    """JSファイルから日本語文字列リテラルを抽出"""
    with open(js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    translations = {}
    japanese_texts = set()

    # パターン1: 'ja': 'en' や "ja": "en" のマッピング
    # e.g., '営業': 'Sales'
    map_pattern = re.compile(
        r"""['"]([^'"]+)['"]""" + r"""\s*:\s*['"]([^'"]+)['"]"""
    )
    for m in map_pattern.finditer(content):
        key, val = m.group(1).strip(), m.group(2).strip()
        if has_japanese(key) and not has_japanese(val):
            translations[key] = val

    # パターン2: t('ja', 'en') ヘルパー関数呼び出し
    t_pattern = re.compile(
        r"""\bt\(\s*['"]([^'"]+)['"]""" + r"""\s*,\s*['"]([^'"]+)['"]"""
    )
    for m in t_pattern.finditer(content):
        ja, en = m.group(1).strip(), m.group(2).strip()
        if has_japanese(ja):
            translations[ja] = en

    # パターン3: data-ja="..." data-en="..." in JS template strings
    data_attr_pattern = re.compile(
        r"""data-ja=['"]([^'"]+)['"]""" + r"""[^>]*data-en=['"]([^'"]+)['"]"""
    )
    for m in data_attr_pattern.finditer(content):
        ja, en = m.group(1).strip(), m.group(2).strip()
        if has_japanese(ja):
            translations[ja] = en

    # パターン4: 単独の日本語文字列リテラル（翻訳候補として収集）
    str_pattern = re.compile(r"""['"]([^'"]{2,})['"]""")
    for m in str_pattern.finditer(content):
        text = m.group(1).strip()
        if has_japanese(text) and text not in SKIP_TEXTS:
            japanese_texts.add(text)

    # パターン5: _en フィールド
    # e.g., title_en: 'BMS Transport', question_en: 'Select...'
    en_field_pattern = re.compile(
        r"""(\w+)_en\s*:\s*['"]([^'"]+)['"]"""
    )
    # 対応するjaフィールドを探す
    ja_field_pattern = re.compile(
        r"""(\w+)\s*:\s*['"]([^'"]+)['"]"""
    )

    return translations, japanese_texts


# ============================================================
# 自動翻訳（urllib のみ使用 — 外部依存なし）
# ============================================================
def auto_translate_batch(texts, src='ja', dest='en', delay=1.0):
    """
    Google翻訳の非公式APIで一括翻訳（urllib使用、pip不要）
    レート制限に注意: delayを設定
    """
    try:
        from urllib.request import Request, urlopen
        from urllib.parse import urlencode, quote
    except ImportError:
        print('[ERROR] urllib not available')
        return {}

    results = {}
    total = len(texts)

    for i, text in enumerate(texts):
        try:
            # Google翻訳の非公式エンドポイント
            url = 'https://translate.googleapis.com/translate_a/single'
            params = urlencode({
                'client': 'gtx',
                'sl': src,
                'tl': dest,
                'dt': 't',
                'q': text
            })
            full_url = f'{url}?{params}'

            req = Request(full_url, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; i18n-build/1.0)'
            })
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                # 結果は [[["translation","original",...],...],...] の形式
                if data and data[0]:
                    translated = ''.join(seg[0] for seg in data[0] if seg[0])
                    if translated and translated != text:
                        results[text] = translated
                        print(f'  [{i+1}/{total}] {text[:30]}... → {translated[:30]}...')

            if delay > 0 and i < total - 1:
                time.sleep(delay)

        except Exception as e:
            print(f'  [WARN] Translation failed for "{text[:30]}...": {e}')
            continue

    return results


# ============================================================
# メイン処理
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='BizManga i18n Build Tool')
    parser.add_argument('--auto-translate', action='store_true',
                        help='Auto-translate missing entries via Google Translate')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show changes without writing files')
    parser.add_argument('--report', action='store_true',
                        help='Only show untranslated report')
    parser.add_argument('--delay', type=float, default=0.5,
                        help='Delay between API calls (seconds)')
    args = parser.parse_args()

    print('=' * 60)
    print('BizManga i18n Build Tool')
    print('=' * 60)

    # 1. 既存の en.json を読み込み
    existing = {}
    if os.path.exists(EN_JSON_PATH):
        with open(EN_JSON_PATH, 'r', encoding='utf-8') as f:
            existing = json.load(f)
        print(f'\n[1] Loaded existing en.json: {len(existing)} entries')
    else:
        print(f'\n[1] No existing en.json found, starting fresh')

    # 2. HTMLファイルから抽出
    html_translations = {}
    html_ja_texts = set()
    html_files = glob.glob(os.path.join(HTML_DIR, '*.html'))

    print(f'\n[2] Scanning {len(html_files)} HTML files...')
    for hf in sorted(html_files):
        trans, texts = extract_from_html(hf)
        fname = os.path.basename(hf)
        print(f'  {fname}: {len(trans)} pairs, {len(texts)} text nodes')
        html_translations.update(trans)
        html_ja_texts.update(texts)

    # 3. JSファイルから抽出
    js_translations = {}
    js_ja_texts = set()
    js_files = glob.glob(os.path.join(JS_DIR, '*.js'))

    print(f'\n[3] Scanning {len(js_files)} JS files...')
    for jf in sorted(js_files):
        trans, texts = extract_from_js(jf)
        fname = os.path.basename(jf)
        if trans or texts:
            print(f'  {fname}: {len(trans)} pairs, {len(texts)} Japanese strings')
        js_translations.update(trans)
        js_ja_texts.update(texts)

    # 4. 統合: 既存 > HTML > JS の優先度で統合
    merged = {}

    # まず抽出した翻訳ペアを入れる（HTMLが先、JSで上書き可）
    for ja, en in html_translations.items():
        merged[ja] = en
    for ja, en in js_translations.items():
        if ja not in merged:  # HTMLの方を優先
            merged[ja] = en

    # 既存のen.jsonで上書き（既存翻訳を最優先）
    for ja, en in existing.items():
        merged[ja] = en

    # 5. 全日本語テキストから未翻訳を特定
    all_ja_texts = html_ja_texts | js_ja_texts
    untranslated = set()
    for text in all_ja_texts:
        if text not in merged and has_japanese(text):
            # すでに辞書のキーに部分一致するものは除外
            untranslated.add(text)

    # ソート: キーの長さ順（短い方が汎用性高い）
    sorted_merged = dict(sorted(merged.items(), key=lambda x: (len(x[0]), x[0])))

    # 6. レポート出力
    new_from_html = set(html_translations.keys()) - set(existing.keys())
    new_from_js = set(js_translations.keys()) - set(existing.keys())

    print(f'\n{"=" * 60}')
    print(f'REPORT')
    print(f'{"=" * 60}')
    print(f'  Existing translations:     {len(existing)}')
    print(f'  New from HTML:             {len(new_from_html)}')
    print(f'  New from JS:               {len(new_from_js)}')
    print(f'  Total merged:              {len(sorted_merged)}')
    print(f'  Untranslated text nodes:   {len(untranslated)}')

    if new_from_html:
        print(f'\n  --- New from HTML ---')
        for t in sorted(new_from_html, key=len):
            print(f'    + {t[:60]} → {html_translations[t][:40]}')

    if new_from_js:
        print(f'\n  --- New from JS ---')
        for t in sorted(new_from_js, key=len):
            print(f'    + {t[:60]} → {js_translations[t][:40]}')

    if untranslated:
        print(f'\n  --- Untranslated (text nodes / JS strings) ---')
        for t in sorted(untranslated, key=len)[:50]:
            print(f'    ? {t[:80]}')
        if len(untranslated) > 50:
            print(f'    ... and {len(untranslated) - 50} more')

    if args.report:
        return

    # 7. 自動翻訳
    if args.auto_translate and untranslated:
        print(f'\n[7] Auto-translating {len(untranslated)} entries...')
        auto_results = auto_translate_batch(
            sorted(untranslated, key=len),
            delay=args.delay
        )
        if auto_results:
            for ja, en in auto_results.items():
                sorted_merged[ja] = en
            # 再ソート
            sorted_merged = dict(sorted(sorted_merged.items(),
                                        key=lambda x: (len(x[0]), x[0])))
            print(f'  Auto-translated: {len(auto_results)} entries')

    # 8. en.json 書き出し
    if args.dry_run:
        print(f'\n[DRY RUN] Would write {len(sorted_merged)} entries to en.json')
        if len(sorted_merged) != len(existing):
            print(f'  Change: {len(existing)} → {len(sorted_merged)} entries '
                  f'(+{len(sorted_merged) - len(existing)})')
    else:
        # ディレクトリ作成
        os.makedirs(os.path.dirname(EN_JSON_PATH), exist_ok=True)
        with open(EN_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(sorted_merged, f, ensure_ascii=False, indent=2)
        print(f'\n[OK] Written {len(sorted_merged)} entries to {EN_JSON_PATH}')

    print(f'\nDone!')


if __name__ == '__main__':
    main()
