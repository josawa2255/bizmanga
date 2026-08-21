# マンガの種類ページ（/manga-types）画像生成プロンプト集

ChatGPT **Image 2.0** 用のプロンプトです。現在 `images/manga-types/` に入っているのは
中央に日本語ラベルと「PLACEHOLDER — 差し替え待ち」と書かれた仮画像です。
本番の画像を**同名で上書き保存**してください（差し替えるだけでページに反映されます）。

## 全体の流れ

ChatGPTの**同じチャット**の中で、メッセージを**合計11通**送ります。

| 送信 | 内容 | このページの場所 |
|---|---|---|
| 1通目 | 画風を指定する文章（+画像2枚を添付） | [下の「送信1」](#送信1画風指定--最初に1回だけ) |
| 2〜8通目 | 7ジャンルそれぞれの絵の内容（1枚＝1通） | [下の「A. 7ジャンル」#01〜#07](#a-7ジャンル7枚) |
| 9〜11通目 | ページ構成カット3枚の絵の内容（1枚＝1通） | [下の「B. ページ構成カット」#08〜#10](#b-ページ構成カット3枚) |

チャットを分けると画風の記憶が切れてしまうので、**11通とも同じチャットで**続けて送ってください。

> **すでに7ジャンル分（#01〜#07）を生成済みの場合**: そのときの同じチャットが残っていれば、そこに続けて #08〜#10 を送るだけでOKです（送信1をやり直す必要はありません）。チャットが見つからない・新しく始める場合は、送信1からやり直してください。

---

## 送信1（画風指定）— 最初に1回だけ

### ① まず画像を2枚添付する

ChatGPTの新しいチャットを開き、次の2枚の画像ファイルを**チャットに添付**してください（テキストはまだ送らない）。

| 添付するファイル | 役割 |
|---|---|
| `images/recruit-manga/merit-01.png` | 画風・配色の基準（横長カット） |
| `images/product-manga/merit-01.png` | 画風・配色の基準（横長カット・別アングル確認用） |

### ② 下の枠の中身を全部コピーして、画像といっしょに送信する

👇 **ここから下の灰色の枠の中身だけを**コピーして、ChatGPTのメッセージ欄に貼り付けて送信してください（枠の外の説明文はコピー不要）。

```
添付した2枚は、あるWebサイトで使っている既存イラストです。
これから7枚のイラストを作ります。すべてこの2枚と同じ画風・配色・線のタッチに
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

ChatGPTから「OK」と返事が来たら、次の「送信2」に進んでください（画像はまだ生成されません。これは画風合わせのための下準備メッセージです）。

---

## 送信2〜11（10枚の絵の内容）— #01から#10まで順番に

下に **#01〜#10** の10個のプロンプトが並んでいます（A. 7ジャンル + B. ページ構成カット3枚）。**1個ずつ、送信1と同じチャットに**貼り付けて送信してください。1通送るごとに1枚の画像が生成されます。

各プロンプトについて、コピーするのは以下の**灰色の枠の中身だけ**です。

- ❌ コピー不要: 見出し行（`### #01 保存パス: ...`）
- ✅ コピーする: その直下の ```` ``` ```` 〜 ```` ``` ```` で囲まれた英文だけ

生成されたPNG画像は、見出しに書かれている**保存パスのファイル名で** `images/manga-types/` に**上書き保存**してください（例: #01なら `type-founding.png`、#08なら `format-1koma.png` という名前で保存）。

> **WebP変換について**: PNGを保存したら、ファイル名と一緒に「PNG保存したので.webpも作ってください」とこちらに伝えてもらえれば、こちらで `.webp` を作成します。手元にツールを用意する必要はありません。

### 生成サイズ

全10枚とも ChatGPTに **横長 1536×1024** で生成するよう指定してください（プロンプト冒頭にすでに書いてあります）。CSS側でA(#01〜#07)は16:10、B(#08〜#10)は4:3に中央トリミングされるため、**絵の主要な要素は中央80%に収めてください**（プロンプト内にもその指示が入っています）。

### 似なかったときの修正文

生成結果が画風から3点ずれやすいことが分かっています。ズレていたら、[docs/strength-image-prompts.md](strength-image-prompts.md) の「似なかったときの修正文」セクションの枠の中身をそのままコピーしてChatGPTに送ってください（内容は今回も共通で使えます）。

---

## A. 7ジャンル（7枚）

「ビジネス漫画の7つの種類」グリッド（#01〜#07）に使う挿絵です。

### #01 保存パス: `images/manga-types/type-founding.png` — 創業ストーリー

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

Scene: an older Japanese company founder in his 60s, in a simple navy cardigan, sits at
a light wooden desk holding an old framed photograph of a small shopfront, looking at
it with a warm, nostalgic smile. Behind him, a soft pale-blue watercolor cloud shows a
faint younger version of himself opening the same shop, like a memory. A short orange
stroke marks a small warm glow near the photo frame.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #02 保存パス: `images/manga-types/type-recruit.png` — 採用漫画

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

Scene: a young Japanese employee in her 20s, in a light blue-gray blazer, gestures
cheerfully with one open hand toward the office behind her, guiding a job candidate
(seen from behind, out of focus) through the workspace. Her expression is warm and
welcoming. A short orange sparkle sits near her raised hand to suggest enthusiasm.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #03 保存パス: `images/manga-types/type-casestudy.png` — 導入事例・顧客の声

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

Scene: a Japanese client-side manager in her 30s, in a soft gray blouse, holds up a
tablet showing a simple upward-trending line, smiling with quiet satisfaction. Beside
her, a faint pale-blue watercolor split-panel silhouette shows a slumped figure on the
left (before) and the same figure standing confidently on the right (after). A short
orange stroke highlights the upward trend on the tablet.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #04 保存パス: `images/manga-types/type-howto.png` — How to（使い方ガイド）

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

Scene: a Japanese user in his 20s, in a casual gray hoodie, looks at a smartphone in
one hand and points at it with the other, wearing a satisfied "I get it now" grin.
Beside him, a faint pale-blue watercolor cloud shows three simple numbered steps
(drawn as plain rounded shapes, not text) in a row, with the last one glowing softly.
A short orange checkmark-like stroke sits above the final step.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #05 保存パス: `images/manga-types/type-product.png` — 商品説明

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

Scene: a Japanese marketing woman in her 30s, in a light blue-gray cardigan, holds up a
simple plain product box with both hands at chest height, presenting it with a bright,
confident smile, as if introducing it to the viewer. A short orange starburst sits just
above the box to mark it as the highlight.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #06 保存パス: `images/manga-types/type-training.png` — 研修マニュアル

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

Scene: on the right, a young Japanese new employee in his 20s sits at a desk reading an
open manga-style booklet, taking notes with a pen, focused and calm. On the left, a
senior colleague in her 30s stands beside him, watching over his shoulder with an
approving, gentle smile. A short orange stroke marks a small lightbulb-like spark above
the booklet.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #07 保存パス: `images/manga-types/type-profile.png` — 社長・プロフィール

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

Scene: a Japanese company president in her 50s, in a tailored navy blazer, sits
relaxed with one hand resting near her chin, speaking warmly toward the viewer as if
being interviewed, a calm and approachable expression on her face. Behind her, a faint
pale-blue watercolor silhouette of a simple microphone floats softly. A short orange
stroke highlights the edge of the microphone.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

---

## B. ページ構成カット（3枚）

「ページ構成で選ぶ、3つの型」カード（1コマ／4コマ／ストーリー型）に使う挿絵です。CSS側で4:3に
トリミングされます。3枚とも同じ人物にする必要はありません。

### #08 保存パス: `images/manga-types/format-1koma.png` — 1コマ漫画

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

Scene: a young Japanese person in casual clothes holds up a smartphone at chest height,
looking at the screen with a surprised, delighted expression, thumb frozen mid-scroll.
On the screen, drawn as a simple plain rounded square, a single large illustrated panel
is visible (do not draw any content inside the square, keep it a plain pale-blue-gray
watercolor rectangle). A short orange sparkle sits at the corner of the phone screen to
mark the moment of impact.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #09 保存パス: `images/manga-types/format-4koma.png` — 4コマ漫画

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

Scene: a Japanese office worker in her 20s sits at a desk reading a printed newsletter
page, one finger tracing along the page, smiling with amusement. The page she holds
shows a simple grid of four plain rounded squares arranged 2x2 (do not draw any content
inside the squares, keep them plain pale-blue-gray watercolor rectangles with thin ink
borders). A short orange stroke marks a small laugh-mark near her face.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #10 保存パス: `images/manga-types/format-story.png` — ストーリー型（6〜10ページ）

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

Scene: a Japanese person in his 30s sits comfortably, deeply absorbed, holding open a
thick multi-page booklet with both hands, visible page thickness on the side, eyes
focused intently on the pages, a quietly moved expression. A soft pale-blue watercolor
cloud behind him suggests several overlapping page silhouettes drifting upward, like
the story continuing beyond the page. A short orange stroke highlights near his eyes to
show emotional engagement.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

---

## 生成しないもの（既存流用）

| 用途 | 参照先 | 理由 |
|---|---|---|
| ヒーロー背景 | `material/images/lp/recruit-hero-v2.webp` / `-sp.webp` | 商品紹介マンガ・強み・マンガ広告と**同一画像**。トップの見た目を揃えるための流用。新規生成は不要 |
| OG 画像 | `material/images/og/og-manga-types.webp` | 既存のまま。新規生成は不要 |

新規カットを足すときは**必ず recruit-manga の画像を基準**にしてください（サイト全体の画風の正本）。
