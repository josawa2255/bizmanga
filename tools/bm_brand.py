"""Ordered normalization rules for published brand copy."""

import re

from bm_pricing import normalize_price_text


BRAND_TEXT_RULES = (
    (r'「人間7割[×xX]AI3割」のハイブリッド制作体制', '独自の制作メソッド'),
    (r'「人間7割[×xX]AI3割」のハイブリッド制作', '独自の制作メソッド'),
    (r'「人間7割[×xX]AI3割」のハイブリッド', '独自の制作メソッド'),
    (r'「人間7割[×xX]AI3割」の体制', '独自の制作メソッド'),
    (r'「人間7割[×xX]AI3割」', '独自の制作メソッド'),
    (r'人間7割[×xX]AI3割のハイブリッド制作体制', '独自の制作メソッド'),
    (r'人間7割[×xX]AI3割のハイブリッド制作', '独自の制作メソッド'),
    (r'人間7割[×xX]AI3割のハイブリッド', '独自の制作メソッド'),
    (r'人間7割[×xX]AI3割の体制', '独自の制作メソッド'),
    (r'人間7割[×xX]AI3割', '独自の制作メソッド'),
    (r'7割人間・3割AI', '独自の制作メソッド'),
    (r'人の手7割[×xX]AI3割のハイブリッド制作', '独自の制作メソッド'),
    (r'人の手7割[×xX]AI3割', '独自の制作メソッド'),
)


def normalize_brand_text(text, *, prices=True):
    """ブランド方針に沿ってWP由来テキストを正規化する（冪等）。
    - AI混在比率表現（「人間7割×AI3割」「ハイブリッド制作」等）→「独自の制作メソッド」
      （方針: 比率系コピー禁止。memory feedback_no_ai_ratio_copy）
    - 旧料金コピー → 現行基本料金25,740円〜（税抜・原稿料別途）
    WP本文がマスターのままでも、ビルド時に公開HTMLを方針準拠へ正規化する。
    """
    if not text:
        return text
    for pattern, replacement in BRAND_TEXT_RULES:
        text = re.sub(pattern, replacement, text)
    return normalize_price_text(text) if prices else text
