# 強みページ（/strength）画像生成プロンプト集

ChatGPT **Image 2.0** 用のプロンプトです。`strength.html` の各 `<!-- IMAGE-PROMPT: ... #NN -->`
コメントが、この文書の番号に対応しています。

## 使い方

### ステップ0（必須）— 先に参考画像を添付する

**文章だけで画風を揃えるのは無理があります。** 生成を始める前に、ChatGPT の新しいチャットに
次の2枚を**画像として添付**し、下の一文を送ってください。

| 添付する画像 | 役割 |
|---|---|
| `images/recruit-manga/merit-01.png` | 横長カット（#06〜#13）の画風・配色の基準 |
| `images/training-manga/format-elearning.png` | 縦長カット（#01〜#05）の画風・配色の基準 |

```
添付した2枚は、あるWebサイトで使っている既存イラストです。
これから13枚のイラストを作ります。すべてこの2枚と同じ画風・配色・線のタッチに
厳密に揃えてください。特に次の4点を守ってください。

1. 人物はアニメ・マンガ調。目・鼻・口は簡略化し、肌と髪の陰影は最小限、
   黒に近いインクの輪郭線をはっきり出す。実写寄りの水彩ポートレートにはしない。
2. 背景は白。キャンバスの7割以上を紙の白のまま残し、水彩のにじみは人物のすぐ
   後ろに雲のように少し置くだけ。四隅と画面の縁には何も塗らない。
3. 配色は彩度の低い青灰色・ネイビー・ニュートラルグレー。セピアやベージュの
   暖色を背景にかけない。木製の小物だけ淡い木の色でよい。
4. オレンジは集中線や小さなハイライトなど、ごく一部にだけ使う。

フラットベクター・アイコン調・企業クリップアート調にはしないでください。
画像内に文字・数字・ロゴは一切入れないでください。
了解したら「OK」とだけ返してください。
```

「OK」が返ってきたら、以下のプロンプトを**1枚ずつ**貼っていきます。

### ステップ1〜3

1. 各プロンプトの ``` 枠の**中身だけ**をコピーして貼る（見出し `### #01 保存パス: ...` はコピー不要）
2. 生成された PNG を、見出しの**保存パス**のファイル名で `images/strength/` に上書き保存
3. 同名の `.webp` も書き出す（`<picture>` の `<source>` が参照するので必須）

```bash
# PNG → WebP 変換（ChatGPT用ではなくターミナル用。cwebp が入っている場合）
cd images/strength
for f in *.png; do cwebp -q 82 "$f" -o "${f%.png}.webp"; done
```

チャットを分けると参考画像の記憶が切れるので、**13枚とも同じチャットで続けて**
生成してください。

### 似なかったときの修正文

実際にズレやすいのは次の3点です。該当するものをそのままチャットに貼ってください。

```
参考画像から3点ずれているので直してください。

1. 背景を白くしてください。いまキャンバス全面が水彩で塗られていますが、参考画像は
   背景の7割以上が白い紙のままです。水彩のにじみは人物のすぐ後ろに雲のように
   少し置くだけにして、画面の四隅と縁は何も塗らず完全に白のままにしてください。

2. 人物をアニメ・マンガ調にしてください。いまは実写寄りの水彩ポートレートに
   なっています。目や鼻や口をもっと簡略化し、肌や髪の陰影を減らし、
   黒に近いインクの輪郭線をはっきり出してください。

3. 全体の色をセピア・ベージュ寄りからニュートラルな青灰色寄りに戻してください。
   背景に暖色のクリーム色をかけないでください。木の机だけ淡い木の色で構いません。

構図・小物・オレンジの集中線はこのままで大丈夫です。
```

> **注意**: いま `images/strength/` に入っているのは中央に「PLACEHOLDER #NN」と書かれた
> 仮画像です。本番の画像を同名で上書きしてください。マージ前に必ず差し替えること。

## 生成サイズ

| 区分 | ChatGPTで指定するサイズ | 表示のされ方 |
|---|---|---|
| #01〜#05 強みインデックス | **1024×1536（縦長）** | CSS で正方形に中央トリミング |
| #06〜#08 お悩み | **1536×1024（横長）** | 全体をそのまま表示 |
| #09〜#13 仕組み | **1536×1024（横長）** | CSS で 16:10 に中央トリミング |

#06〜#08 は他LPでは 2.5:1 の細い帯になっています。厳密に合わせたい場合のみ、生成後に
`sips -c 614 1536 --cropOffset 205 0 pain-01.png --out pain-01.png` で上下を落とせます（任意）。

---

## A. 強みインデックス（縦長 5 枚 / 1024×1536）

### #01 保存パス: `images/strength/str-price.png`

```
Create a vertical illustration (1024x1536).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: a Japanese businesswoman in her 30s wearing a soft blue-gray jacket sits at a
light wooden desk, looking at a printed quotation sheet with a relieved, pleasantly
surprised smile. Beside the sheet lies a small stack of coins and a calculator. Three
short orange emphasis strokes radiate near her head to show a happy realization.

Natural, gentle expression. Not flat vector, not icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #02 保存パス: `images/strength/str-speed.png`

```
Create a vertical illustration (1024x1536).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: a Japanese businessman in his 30s in a soft blue-gray shirt stands beside a
large desk calendar, marking a near date with a light smile of confidence. On the desk
next to him sits a simple round clock. A few short orange motion strokes trail behind
his hand to suggest speed.

Natural, gentle expression. Not flat vector, not icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #03 保存パス: `images/strength/str-quality.png`

```
Create a vertical illustration (1024x1536).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: a Japanese editor in his 40s wearing glasses and a soft gray shirt leans over a
light wooden desk, checking a manga page on a clipboard with a red pen held in his
hand, focused and calm. Beside the clipboard rests a long checklist sheet with rows of
small ticked boxes. A tiny orange checkmark floats near the top corner.

Natural, gentle expression. Not flat vector, not icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #04 保存パス: `images/strength/str-copyright.png`

```
Create a vertical illustration (1024x1536).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: a Japanese businesswoman in her 30s in a navy blazer holds a thick stack of
original manga artwork boards close to her chest with both arms, smiling with quiet
relief. Behind her, a soft watercolor silhouette of a shield with a small open padlock
floats faintly, drawn in pale blue-gray. The padlock shackle has a thin orange
highlight.

Natural, gentle expression. Not flat vector, not icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no letters, no copyright symbols, no logos anywhere in the image.
```

### #05 保存パス: `images/strength/str-media.png`

```
Create a vertical illustration (1024x1536).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: a Japanese marketing woman in her 30s in a light blue-gray cardigan holds an
open manga book with both hands, looking up cheerfully. Floating around her in a soft
watercolor thought-cloud are four small objects drawn at similar size: a laptop, a
smartphone, a folded printed pamphlet, and a small video player frame. A short orange
stroke connects the book toward the cloud.

Natural, gentle expression. Not flat vector, not icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no letters, no logos anywhere in the image.
```

---

## B. お悩み（横長 3 枚 / 1536×1024）

### #06 保存パス: `images/strength/pain-01.png` — 見積もりが想定の3倍

```
Create a horizontal illustration (1536x1024).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: on the left, a Japanese businessman in his 30s in a blue-gray hoodie sits at a
light wooden desk, holding up a printed quotation sheet with both hands and staring at
it with a stunned, deflated expression, shoulders dropped. On the right, inside a soft
pale-blue watercolor thought-cloud, several quotation documents float, each showing
blank ruled line-blocks and one filled bar at the bottom, drawn in muted blue-gray. A
single short orange stroke sits near his head to mark the shock.

Compose the subject on the left and the thought-cloud on the right, both within the
central horizontal band. Not flat vector, not icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #07 保存パス: `images/strength/pain-02.png` — 納期が読めず施策に間に合わない

```
Create a horizontal illustration (1536x1024).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: on the right, a Japanese businesswoman in her 30s in a light blouse stands with
one hand on her chin, brow furrowed with worry, looking to her left. On the left,
inside a soft pale-blue watercolor thought-cloud, a large wall calendar page with a
grid of empty squares floats, with one square far to the right circled in thin orange.
A simple round wall clock sits beside the calendar inside the same cloud.

Compose the thought-cloud on the left and the subject on the right, both within the
central horizontal band. Not flat vector, not icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #08 保存パス: `images/strength/pain-03.png` — 品質のばらつきと著作権の不安

```
Create a horizontal illustration (1536x1024).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: on the left, a Japanese businessman in his 40s in a gray shirt holds a contract
document loosely in one hand and looks up with a troubled, uncertain frown. On the
right, inside a soft pale-blue watercolor thought-cloud, three manga pages hang side by
side, each drawn at a visibly different level of finish — one neat and complete, one
rough and sketchy, one half-drawn — to show inconsistent quality. A small orange
question mark floats between him and the cloud.

Compose the subject on the left and the thought-cloud on the right, both within the
central horizontal band. Not flat vector, not icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no letters, no logos anywhere in the image.
```

---

## C. 仕組み（横長 5 枚 / 1536×1024）

CSS 側で上下がわずかに切り取られるため、**主要な要素は中央 80% に収めてください**。

### #09 保存パス: `images/strength/mech-01.png` — 創造性は人、反復作業はAI

```
Create a horizontal illustration (1536x1024).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: on the left, a Japanese manga artist in her 30s in a soft blue cardigan sits at
a drawing desk, absorbed in sketching a character with a pen, a warm confident
expression on her face. On the right, a laptop on the same desk quietly renders
repetitive background panels and speed lines by itself, drawn in pale blue-gray. Two
short orange strokes float above the laptop to suggest it working on its own.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art.
Absolutely no text, no letters, no logos anywhere in the image.
```

### #10 保存パス: `images/strength/mech-02.png` — 並行進行ワークフロー

```
Create a horizontal illustration (1536x1024).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: three Japanese staff members — a writer with a script, an artist with a tablet,
and an editor with a clipboard — work side by side at the same long light wooden desk,
each on a different task at the same time, all looking relaxed and in sync. Behind
them, three soft watercolor horizontal bands run left to right and overlap each other
rather than starting one after another, suggesting parallel progress. A small orange
flag marks the right end where the three bands meet.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #11 保存パス: `images/strength/mech-03.png` — 125項目の品質チェック

```
Create a horizontal illustration (1536x1024).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: on the right, a Japanese editor in his 40s wearing glasses holds a red pen and
inspects a manga page on a clipboard with a focused, satisfied expression. On the
left, a very long checklist scroll unrolls downward across the frame, densely filled
with rows of small boxes, most of them ticked. A few of the checkmarks are picked out
in orange while the rest stay muted blue-gray.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #12 保存パス: `images/strength/mech-04.png` — 原画資産方式（著作権の全譲渡）

```
Create a horizontal illustration (1536x1024).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: a handover moment at the center of the frame. On the left, a Japanese manga
artist in a soft blue cardigan offers a thick stack of original artwork boards forward
with both hands. On the right, a Japanese businesswoman in a navy blazer receives them
with both hands and a warm, relieved smile. Behind the stack, a faint pale blue-gray
watercolor silhouette of a shield with a small open padlock; the padlock shackle
carries a thin orange highlight.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art.
Absolutely no text, no letters, no copyright symbols, no logos anywhere in the image.
```

### #13 保存パス: `images/strength/mech-05.png` — 1本を4媒体以上の資産に

```
Create a horizontal illustration (1536x1024).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges and
  all four corners must stay plain white with nothing painted on them.
- Cool low-saturation palette: dusty blue-gray, navy, neutral light gray. No sepia, no
  beige, no warm cream tint anywhere in the background. Only small wooden objects may
  carry a pale warm tone.
- Orange (#E85500) appears only as a few short emphasis strokes or one tiny highlight.

Scene: on the left, a Japanese marketing woman in her 30s in a light blue-gray
cardigan holds an open manga book and gestures toward the right with an open palm,
looking pleased. On the right, inside a wide soft watercolor cloud, four items float
at similar size: a laptop showing a web page, a folded printed pamphlet, a smartphone
showing a social post, and a small video player frame. Thin orange strokes fan out
from the book toward the four items.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art.
Absolutely no text, no letters, no logos anywhere in the image.
```

---

## D. 生成しないもの（既存流用）

| 用途 | 参照先 | 理由 |
|---|---|---|
| ヒーロー背景 | `material/images/lp/recruit-hero-v2.webp` / `-sp.webp` | 商品紹介マンガ・マンガ広告と**同一画像**。トップの見た目を揃えるための流用 |
| PROOF ネーム（ラフ） | `material/images/strength/strength-name-before.webp` | 実物の制作物。生成画像に置き換えない |
| PROOF 完成版 | `material/images/strength/strength-name-after.webp` | 同上 |
| OG 画像 | `material/images/og/og-strength.webp` | 既存のまま |

## E. 画風の正本について

8本のLPのうち **recruit / sales / training / company / inbound / ir** は上記の水彩＋線画で統一されています。
`images/product-manga/format-lp.png` と `format-sns.png` だけがフラットベクター調で、これは例外です。
新規カットを足すときは**必ず recruit-manga の画像を基準**にしてください。
