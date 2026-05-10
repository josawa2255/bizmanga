#!/usr/bin/env python3
"""
BizManga works 専用 OG画像を 1200×630 で個別生成する。

- WP API `/works` から作品一覧取得
- 各作品の thumbnail を左側に配置、右側に作品タイトル＋カテゴリ＋ブランド帯を描画
- 出力先: material/images/og/works/{slug}.webp

生成後、build-works.py は og:image を `{SITE}/material/images/og/works/{slug}.webp` に張り替える。

実行タイミング:
- WPで作品が追加された時
- 週次の GitHub Actions `build-works.yml` の前段で実行
"""

import io
import json
import pathlib
import urllib.parse
import urllib.request
from PIL import Image, ImageDraw, ImageFont

API = "https://cms.contentsx.jp/wp-json/contentsx/v1/works"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "material" / "images" / "og" / "works"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# WP管理者が任意URLを thumbnail に入れる経路がある以上、SSRF防止のため取得元を allowlist 化
THUMB_ALLOWED_HOSTS = {"cms.contentsx.jp", "contentsx.jp", "bizmanga.contentsx.jp"}
THUMB_ALLOWED_SCHEMES = {"https"}

# Theme
W, H = 1200, 630
BG_COLOR = (18, 18, 18)
ACCENT = (233, 30, 99)                 # BizManga ピンク (bizmanga brand)
TEXT_PRIMARY = (255, 255, 255)
TEXT_SECONDARY = (200, 200, 200)

FONT_JP = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_EN = "/System/Library/Fonts/Helvetica.ttc"


def fetch_works():
    req = urllib.request.Request(API, headers={"User-Agent": "BizManga-OG-Builder/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode("utf-8"))
    return [w for w in data if w.get("show_site") == "both"]


def load_thumb(url):
    if not url:
        return None
    try:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme not in THUMB_ALLOWED_SCHEMES or parsed.hostname not in THUMB_ALLOWED_HOSTS:
            print(f"  thumb skipped (host/scheme not allowed): {url}")
            return None
        safe_path = urllib.parse.quote(parsed.path, safe="/")
        safe_url = urllib.parse.urlunsplit(
            (parsed.scheme, parsed.netloc, safe_path, parsed.query, parsed.fragment)
        )
        req = urllib.request.Request(safe_url, headers={"User-Agent": "BizManga-OG-Builder/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return Image.open(io.BytesIO(r.read())).convert("RGB")
    except Exception as e:
        print(f"  thumb fetch failed: {e}")
        return None


def wrap_text(text, font, max_width, draw):
    """日本語は文字単位で改行する簡易ラッパ。"""
    lines = []
    current = ""
    for ch in text:
        test = current + ch
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] > max_width and current:
            lines.append(current)
            current = ch
        else:
            current = test
    if current:
        lines.append(current)
    return lines


def render(work):
    slug = work["id"]
    title = work.get("title_ja") or slug
    category = work.get("category") or "制作事例"
    media = " / ".join(work.get("media") or []) or ""

    img = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # 左サイドのアクセント帯
    draw.rectangle([0, 0, 16, H], fill=ACCENT)

    # 左半分にサムネ配置 (480×H エリア)
    thumb_area_w = 480
    thumb_area_x = 32
    thumb = load_thumb(work.get("thumbnail") or (work.get("gallery") or [None])[0])
    if thumb:
        # height fit
        ratio = (H - 64) / thumb.height
        new_w = int(thumb.width * ratio)
        new_h = H - 64
        thumb_resized = thumb.resize((new_w, new_h), Image.LANCZOS)
        # center crop width to thumb_area_w
        if new_w > thumb_area_w:
            crop_x = (new_w - thumb_area_w) // 2
            thumb_resized = thumb_resized.crop((crop_x, 0, crop_x + thumb_area_w, new_h))
        img.paste(thumb_resized, (thumb_area_x, 32))

    # 右ブロック開始
    right_x = thumb_area_x + thumb_area_w + 48
    right_w = W - right_x - 64

    # ブランドマーク (BizManga)
    brand_font = ImageFont.truetype(FONT_EN, 32)
    draw.text((right_x, 56), "BizManga", font=brand_font, fill=TEXT_PRIMARY)
    draw.rectangle([right_x, 96, right_x + 88, 100], fill=ACCENT)

    # カテゴリタグ
    cat_font = ImageFont.truetype(FONT_JP, 22)
    cat_bbox = draw.textbbox((0, 0), category, font=cat_font)
    cat_w = cat_bbox[2] - cat_bbox[0]
    draw.rectangle([right_x, 140, right_x + cat_w + 32, 180], fill=ACCENT)
    draw.text((right_x + 16, 146), category, font=cat_font, fill=TEXT_PRIMARY)

    # タイトル（最大3行ラップ）
    title_font = ImageFont.truetype(FONT_JP, 52)
    title_lines = wrap_text(title, title_font, right_w, draw)[:3]
    line_h = 70
    y = 220
    for ln in title_lines:
        draw.text((right_x, y), ln, font=title_font, fill=TEXT_PRIMARY)
        y += line_h

    # メディア
    if media:
        media_font = ImageFont.truetype(FONT_JP, 22)
        draw.text((right_x, H - 110), media, font=media_font, fill=TEXT_SECONDARY)

    # URL帯
    url_font = ImageFont.truetype(FONT_EN, 22)
    draw.text((right_x, H - 72), "bizmanga.contentsx.jp", font=url_font, fill=ACCENT)

    out = OUT_DIR / f"{slug}.webp"
    img.save(out, "WEBP", quality=88, method=6)
    print(f"Generated: {out.name}")


def main():
    works = fetch_works()
    print(f"Works to render: {len(works)}")
    for w in works:
        render(w)
    print("Done.")


if __name__ == "__main__":
    main()
