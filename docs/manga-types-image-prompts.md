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

### #11 保存パス: `images/manga-types/format-vertical.png` — 縦読み（2026-08-31追加。#08〜#10と同じ「いつも通り」の汎用人物）

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

Scene: a young Japanese person in casual clothes holds their smartphone upright in
portrait orientation with one hand, thumb mid-swipe scrolling upward on the screen, a
focused, engaged half-smile. The phone screen shows three simple plain
rounded-rectangle panels stacked vertically (do not draw any content inside them, keep
them plain pale-blue-gray watercolor rectangles), with the top one partly cut off at
the top edge of the screen to suggest continuous scrolling. A short orange stroke sits
near their thumb.

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

---

## C. 「映画館」リデザイン (2026-08-31) で追加したプレースホルダー

### C-1. プロローグの3コマ予告編（ファーストビュー右側）

現在は実写イラストではなく、**インラインSVGのピクトグラム**（吹き出し+×／電球／吹き出し+チェック）で
仮組みしています。`manga-types.html` 側は既に差し替え前提の構造になっており、404を避けるため
実在しない画像への `<img>` 参照は置いていません（`<picture>` ブロックはHTMLコメントとして
あらかじめ用意してあります）。

**差し替え手順**: `manga-types.html` の `.mt-trailer-frame__art` 内、各 `.mt-trailer-frame__glyph`
の直前にあるHTMLコメント（`<!-- 画像差し替え用（未生成）: ... -->`）のコメントを外し、
その下の既存 `<span class="mt-trailer-frame__glyph">…SVG…</span>` を削除するだけで反映されます
（クラス名 `mt-trailer-frame__glyph` を `<picture>` 側に付け替えて使うため、CSSの追加変更は不要。
`img` には `object-fit:cover` が既に効くようにしてあるので、枠内に自動でトリミング表示されます）。

| # | 保存パス（未生成） | 表示箇所 | 推奨比率・サイズ |
|---|---|---|---|
| 1 | `images/manga-types/trailer-01-problem.png` / `.webp` | プロローグ CUT 01（悩んでいる） | 横長 3:2（例 384×256 以上） |
| 2 | `images/manga-types/trailer-02-idea.png` / `.webp` | プロローグ CUT 02（気づく） | 横長 3:2（例 384×256 以上） |
| 3 | `images/manga-types/trailer-03-result.png` / `.webp` | プロローグ CUT 03（伝わる） | 横長 3:2（例 384×256 以上） |

内容案（このドキュメントのA節と同じ画風で。**画像そのものはこの追記時点では生成しない**）:

1. 悩んでいる: 資料や商品を前に困惑・説明に苦戦している企業担当者
2. 気づく: マンガの原稿やコマ割りを見て表情が明るくなる瞬間
3. 伝わる: 相手（顧客・候補者など）が納得・行動している場面

3枚とも横長 1536×1024 で生成し、3:2に中央トリミングされる前提でA節と同じ画風指定を使ってください。

### C-2. SCREENING FORMAT（上映形式）のプレビュー

1コマ/4コマ/ストーリー型/縦読みのプレビューは、あえて実写を使わず**CSSのみ**でコマ割りの形を
表現しています（`.mt-ticket-preview--*`）。実写化は必須ではありません。もし将来 `format-1koma.png` /
`format-4koma.png` / `format-story.png`（既存・未使用のまま残置）を使いたくなった場合は、
`.mt-ticket-preview` 内に `<picture>` を追加して差し替えてください。縦読み用の実写素材はまだ
存在しないため、追加する場合は新規生成が必要です。

### C-3. 最終CTAの「COMING NEXT」ポスター

キャラクターの詳細を確定させたくないため、頭部+胴体のシルエットのみをCSSで描画しています
（`.mt-cta-poster__figure`）。将来、実際のキャラクターイラスト（後ろ姿・シルエット寄りの構図）に
差し替える場合も、文字（YOUR STORY / COMING NEXT / Produced with BIZMANGA）はHTML側にあるため
画像に文字を焼き込む必要はありません。

---

## D. プロローグ予告編カット（3枚・2026-08-31追加）— ChatGPTにそのまま送れるプロンプト

C-1で必要な3枚（`trailer-01-problem` / `trailer-02-idea` / `trailer-03-result`）の生成手順です。
A・B節と**同じ画風**に揃えるため、送信の流れも同じです。

| 送信 | 内容 |
|---|---|
| 1通目 | 画風を指定する文章（+画像2枚を添付） |
| 2通目 | #D-01（悩んでいる） |
| 3通目 | #D-02（気づく・#D-01と同一人物） |
| 4通目 | #D-03（伝わる・#D-01/02の人物+新しい登場人物） |

> すでにA・B節（#01〜#10）を生成した**同じチャットが残っている場合**は、送信1をやり直す必要はありません。そのまま #D-01 から続けて送ってください。新しいチャットで始める場合のみ、下の送信1から行ってください。

### 送信1（画風指定）— 新しいチャットで始める場合のみ

まず次の2枚をチャットに添付してください（テキストはまだ送らない）。

| 添付するファイル | 役割 |
|---|---|
| `images/recruit-manga/merit-01.png` | 画風・配色の基準（横長カット） |
| `images/product-manga/merit-01.png` | 画風・配色の基準（横長カット・別アングル確認用） |

👇 **ここから下の枠の中身だけ**をコピーして、画像といっしょに送信してください。

```
添付した2枚は、あるWebサイトで使っている既存イラストです。
これから3枚のイラストを作ります。すべてこの2枚と同じ画風・配色・線のタッチに
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

ChatGPTから「OK」と返事が来たら、下の #D-01 に進んでください。

### 送信2〜4（3枚の絵の内容）— #D-01から順番に

1個ずつ、同じチャットに貼り付けて送信してください。コピーするのは灰色の枠の中身だけです。
生成されたPNGは、見出しに書かれた**保存パスのファイル名で** `images/manga-types/` に保存してください。
全3枚とも横長 **1536×1024** で生成し、ページ上では **3:2に中央トリミング**されます。

#### D-01 保存パス: `images/manga-types/trailer-01-problem.png` — CUT 01「悩んでいる」

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

Scene: a Japanese businessperson in their 30s, in a simple gray-blue blazer, sits at a
desk cluttered with papers and an open laptop, one hand resting on their forehead,
brows furrowed in a troubled, searching expression, as if struggling to explain
something clearly. Beside them, a faint pale-blue watercolor cloud shows a loosely
tangled scribble-like shape (soft looping lines only, not readable text or symbols),
suggesting a jumbled, unclear message. A short orange stroke marks a small tense
accent near their temple.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

#### D-02 保存パス: `images/manga-types/trailer-02-idea.png` — CUT 02「気づく」（D-01と同一人物）

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

Scene: the same Japanese businessperson as the previous image (keep the exact same
hairstyle and the same gray-blue blazer), now sitting up straight at the same desk,
holding a blank manga storyboard sheet with both hands (draw it as a plain sheet with
a few empty rounded-rectangle panel outlines — do not draw any artwork or text inside
the panels), eyes wide open with a bright expression of sudden realization, as if a
good idea just struck them. Behind them, a faint pale-blue watercolor cloud shows a
simple lightbulb silhouette. A short orange spark-like stroke sits just above the
storyboard sheet.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

#### D-03 保存パス: `images/manga-types/trailer-03-result.png` — CUT 03「伝わる」（D-01/02の人物+新しい登場人物）

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

Scene: the same Japanese businessperson from the previous two images (keep the exact
same hairstyle and the same gray-blue blazer) holds up a printed manga page toward a
second person — a client or job candidate, seen mostly from behind or in
three-quarter profile, in neutral casual-business clothing. The second person nods
with a convinced, satisfied smile and one hand raised slightly in a small approving
gesture. Behind them, a faint pale-blue watercolor cloud shows a simple upward arrow
shape, suggesting a positive change ahead. A short orange stroke highlights near the
arrow.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### 生成後の手順

1. 生成された3枚のPNGを、それぞれ上記の保存パス名で `images/manga-types/` に保存する
2. 「PNG保存したので.webpも作ってください」と伝えてもらえれば、こちらで `.webp` を作成する
3. `manga-types.html` 内の該当コメント（`<!-- 画像差し替え用（未生成）: ... -->`）を外し、
   直後の `<span class="mt-trailer-frame__glyph">`（SVG版）を削除する

> **2026-08-31 更新**: D-01〜D-03は実際に生成・差し替え済み（登場人物は汎用のビジネスパーソン）。
> 下のE節で、この人物を**ビズマンガの公式マスコットキャラクター**に差し替えるプロンプトを用意した。

---


## E. マスコットキャラクター — 予告編 + 最終CTAポスターのみ（2026-08-31 III/IV）

**2026-08-31 III 変更**: マスコットキャラクターを使うのは**予告編3枚 + 最終CTAポスター用の人物1枚**
だけに限定しました。「物語に合う形式を選ぶ」（SCREENING FORMAT）の形式プレビュー4枚は、
マスコットを使わず**いつも通りの汎用人物**（A・B節と同じ方針、カットごとに別の人物）に戻しています。
形式プレビュー4枚のプロンプトは **B節の #08〜#11** を参照してください（#11「縦読み」はB節に新規
追加済み）。

**2026-08-31 IV 変更**: 最終CTAポスター用の人物（E-04）だけ、**水彩+インク調にしない**方針に変更。
「次に予告編になるのは、御社の物語。」のCTAは大々的で迫力のある見せ場にしたいため、E-04は
E-01〜E-03と別の画風（マスコット自身の実際のセルシェーディング画風をベースに、より劇的でパワフルな
ポスター調のレンダリング）にする。E-01〜E-03（予告編3枚）は引き続き水彩+インク調のまま。

`material/images/character.webp` / `character-cta.webp` の公式マスコットキャラクター（栗色の髪・
緑の瞳・赤いリボン・オレンジのニットベスト）を登場させます。E-01〜E-03は**A・B・D節と同じ水彩+インク
の簡略画風**、E-04だけは**マスコット自身の画風をベースにした、より劇的でパワフルなポスター調**で
描きます（詳細はE-04のプロンプト参照。別チャットで生成することを推奨）。

対象は次の4枚:

| 区分 | 内容 | 保存パス（**上書き**に注意） |
|---|---|---|
| 予告編（再生成） | CUT 01 悩んでいる | `images/manga-types/trailer-01-problem.png` |
| 予告編（再生成） | CUT 02 気づく | `images/manga-types/trailer-02-idea.png` |
| 予告編（再生成） | CUT 03 伝わる | `images/manga-types/trailer-03-result.png` |
| 最終CTA | COMING NEXTポスター用の人物（新規） | `images/manga-types/cta-poster-character.png` |

### 送信1（画風+キャラクター指定）— 新しいチャットで行う

まず次の4枚を**この順番で**チャットに添付してください（テキストはまだ送らない）。

| 添付するファイル | 役割 |
|---|---|
| `images/recruit-manga/merit-01.png` | ①画風の基準（水彩+インク） |
| `images/product-manga/merit-01.png` | ②画風の基準（水彩+インク・別アングル確認用） |
| `material/images/character.webp` | ③キャラクターの見た目の基準（全身） |
| `material/images/character-cta.webp` | ④キャラクターの見た目の基準（バストアップ） |

👇 **ここから下の枠の中身だけ**をコピーして、画像4枚と一緒に送信してください。

```
添付した4枚のうち、①②は「あるWebサイト」で使っている既存イラストの画風見本、③④はこの
Webサイトの公式マスコットキャラクターです。
これから4枚のイラストを作ります。画風は①②に、キャラクターの見た目は③④に、それぞれ
厳密に揃えてください。

【画風（①②を基準に）】
1. 人物はアニメ・マンガ調。目・鼻・口は簡略化し、肌と髪の陰影は最小限、
   黒に近いインクの輪郭線をはっきり出す。実写寄りの水彩ポートレートにはしない。
2. 背景は白。キャンバスの7割以上を紙の白のまま残し、水彩のにじみは人物のすぐ
   後ろに雲のように少し置くだけ。四隅と画面の縁には何も塗らない。
3. 背景ににじみをつける場合の配色は、彩度の低い青灰色・ネイビー・ニュートラル
   グレー。セピアやベージュの暖色を背景にかけない。
4. オレンジは集中線や小さなハイライトなど、ごく一部にだけ使う（ただし下記の
   キャラクター自身の服の色はこの制限の対象外）。

【キャラクターの見た目（③④を基準に、①②の画風で描く）】
5. 髪型: 肩に触れるくらいの明るい栗色（チェスナットブラウン）の髪。頭頂に
   跳ねた毛（アホ毛）が2〜3本立っている。前髪は横に流れる。
6. 目: 緑色の瞳。頬にほんのり赤みのチーク。
7. 髪飾り: 向かって右側に赤いリボン。
8. 服装: 白の襟付きシャツの上に、オレンジ〜レンガ色のノースリーブ・ニット
   ベスト（Vネック）。線と塗りは①②のように簡略化してよいが、色味自体は
   オレンジ〜レンガ色のまま変えないでください。
9. ③④のような精細なセルシェーディング・きらきらした星形ハイライト・
   グラデーションの多用はせず、①②と同じ簡略化されたタッチで描いてください。

フラットベクター・アイコン調・企業クリップアート調にはしないでください。
画像内に文字・数字・ロゴは一切入れないでください。
了解したら「OK」とだけ返してください。
```

ChatGPTから「OK」と返事が来たら、下の #E-01 から順番に送信してください。

### 送信2〜4（予告編3枚の絵の内容）— #E-01から順番に

1個ずつ、同じチャットに貼り付けて送信してください。コピーするのは灰色の枠の中身だけです。
全3枚とも横長 **1536×1024** で生成してください。

#### E-01 保存パス（上書き）: `images/manga-types/trailer-01-problem.png` — CUT 01「悩んでいる」

```
Create a horizontal illustration (1536x1024).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration. Do NOT use glossy cel-shading,
  sparkling star-shaped catchlights, or heavy gradient rendering — keep the line and
  wash technique as flat and simple as the style reference images.
- The character is BizManga's mascot: shoulder-length light chestnut-brown hair with
  2-3 short cowlick strands standing up at the crown, side-swept bangs. Green eyes,
  soft pink blush on the cheeks. A red ribbon bow on her right side (viewer's right).
  She wears a white collared shirt under a sleeveless orange/rust-colored knit vest,
  V-neck. Render her in the same simplified ink-and-wash technique as the style
  reference images, not in a glossy, detailed digital-illustration style.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges
  and all four corners must stay plain white with nothing painted on them.
- Any background wash uses a cool low-saturation palette: dusty blue-gray, navy,
  neutral light gray. No sepia, no beige, no warm cream tint anywhere in the
  background (her orange knit vest keeps its own color — this cool-palette rule is
  for the background only, not her outfit).

Scene: she sits at a desk cluttered with papers and an open laptop, one hand resting
near her cheek, eyebrows drawn together in a worried, puzzled pout, mouth in a small
flat line, as if struggling to explain something clearly. Beside her, a faint
pale-blue watercolor cloud shows a loosely tangled scribble-like shape (soft looping
lines only, not readable text or symbols). A short orange stroke marks a small tense
accent near her temple.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

#### E-02 保存パス（上書き）: `images/manga-types/trailer-02-idea.png` — CUT 02「気づく」（E-01と同一人物）

```
Create a horizontal illustration (1536x1024).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration. Do NOT use glossy cel-shading,
  sparkling star-shaped catchlights, or heavy gradient rendering — keep the line and
  wash technique as flat and simple as the style reference images.
- The character is BizManga's mascot: shoulder-length light chestnut-brown hair with
  2-3 short cowlick strands standing up at the crown, side-swept bangs. Green eyes,
  soft pink blush on the cheeks. A red ribbon bow on her right side (viewer's right).
  She wears a white collared shirt under a sleeveless orange/rust-colored knit vest,
  V-neck. Render her in the same simplified ink-and-wash technique as the style
  reference images, not in a glossy, detailed digital-illustration style.
- Watercolor washes appear ONLY as small soft patches directly behind the subject.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges
  and all four corners must stay plain white with nothing painted on them.
- Any background wash uses a cool low-saturation palette: dusty blue-gray, navy,
  neutral light gray. No sepia, no beige, no warm cream tint anywhere in the
  background (her orange knit vest keeps its own color — this cool-palette rule is
  for the background only, not her outfit).

Scene: at the same desk, she now sits up straight holding a blank manga storyboard
sheet with both hands (a plain sheet with a few empty rounded-rectangle panel
outlines — do not draw any artwork or text inside the panels), her eyes wide, mouth
open in a bright delighted smile, as if a great idea just struck her. Behind her, a
faint pale-blue watercolor cloud shows a simple lightbulb silhouette. A short orange
spark-like stroke sits just above the storyboard sheet.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

#### E-03 保存パス（上書き）: `images/manga-types/trailer-03-result.png` — CUT 03「伝わる」（E-01/02の人物+新しい登場人物）

```
Create a horizontal illustration (1536x1024).

Style — match the attached reference images exactly:
- Japanese anime / manga character design: simplified facial features, clean dark ink
  outlines, flat minimal shading on skin and hair. NOT a realistic watercolor portrait,
  NOT painterly rendering, NOT a detailed illustration. Do NOT use glossy cel-shading,
  sparkling star-shaped catchlights, or heavy gradient rendering — keep the line and
  wash technique as flat and simple as the style reference images.
- The main character is BizManga's mascot: shoulder-length light chestnut-brown hair
  with 2-3 short cowlick strands standing up at the crown, side-swept bangs. Green
  eyes, soft pink blush on the cheeks. A red ribbon bow on her right side (viewer's
  right). She wears a white collared shirt under a sleeveless orange/rust-colored
  knit vest, V-neck. Render her in the same simplified ink-and-wash technique as the
  style reference images.
- Watercolor washes appear ONLY as small soft patches directly behind the subjects.
  Keep the background PURE WHITE across at least 70% of the canvas — all four edges
  and all four corners must stay plain white with nothing painted on them.
- Any background wash uses a cool low-saturation palette: dusty blue-gray, navy,
  neutral light gray. No sepia, no beige, no warm cream tint anywhere in the
  background (her orange knit vest keeps its own color — this cool-palette rule is
  for the background only, not her outfit).

Scene: the mascot holds up a printed manga page toward a second person — a business
client, seen mostly from behind or in three-quarter profile, in simple neutral
business-casual clothing, drawn in the same simplified ink-and-wash style. The second
person nods with a pleased smile and a small raised hand. Behind them, a faint
pale-blue watercolor cloud shows a simple upward arrow shape. A short orange stroke
highlights near the arrow.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

#### E-04（2026-08-31 IV改訂）: 最終CTA「COMING NEXT」ポスター用の人物 — 水彩ではなく、劇的でパワフルなポスター調

保存パス（新規）: `images/manga-types/cta-poster-character.png`

このカットは①②（水彩+インクの画風見本）を使わず、**マスコット自身の画風**
（`character.webp`のような、きちんと描き込まれたアニメ調）をベースに、より劇的・パワフルな
ポスターらしいレンダリングにします。**E-01〜E-04とは別の、新しいチャットで**行ってください
（同じチャットで続けると、直前の水彩指示に引っ張られやすいため）。

まず次の2枚を添付してください（テキストはまだ送らない）。

| 添付するファイル | 役割 |
|---|---|
| `material/images/character.webp` | キャラクターデザイン・画風の基準（全身） |
| `material/images/character-cta.webp` | キャラクターデザイン・画風の基準（バストアップ） |

👇 **ここから下の枠の中身だけ**をコピーして、画像2枚と一緒に送信してください。

```
Create a vertical illustration (1024x1536), full body, centered in the frame.

Style — use the attached reference images for her exact character design (hair,
face, ribbon, outfit), but push the rendering toward a bold, dramatic movie-poster
key visual — NOT a watercolor-and-ink illustration, NOT a flat simple sketch:
- Keep her exact design: shoulder-length light chestnut-brown hair with 2-3 short
  cowlick strands at the crown, side-swept bangs, green eyes, soft cheek blush, a red
  ribbon bow on her right side (viewer's right), white collared shirt under a
  sleeveless orange/rust-colored knit vest.
- Render her with rich, high-quality anime/digital-painting quality: strong
  directional lighting, deep contrast, dynamic rim light wrapping her silhouette,
  more painterly and dramatic than a flat cel-shaded sticker — closer to a theatrical
  movie poster key visual.
- Background: plain flat white, completely clean, no scenery, no gradient, no
  lighting effects painted into the background. (This image will be composited onto
  a separate dark, spotlighted poster background afterward, so all of the drama
  should come from her pose, the lighting ON her, and the rendering quality — not
  from a painted background. Keep the background pure flat white for easy removal.)

Scene: she stands in a bold, confident, larger-than-life hero pose — chin slightly
raised, one hand raised in a strong triumphant gesture (fist-pump or a wide open
"ta-da"-style reveal), chest open toward the viewer, as if she is the star of a big
theatrical reveal. Her hair and the hem of her vest sweep slightly as if caught in a
dramatic gust of wind. Fill most of the vertical frame with her figure (only a small
margin above her head) so she reads as big and powerful, not small or timid.

This should look like a poster-worthy hero shot, not a plain standing greeting pose.

Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### 生成後の手順

1. 4枚のPNGを、上の表の保存パス名で `images/manga-types/` に保存する（E-01〜E-03は**上書き**、
   E-04は新規ファイル）
2. 「PNG保存したので.webpも作ってください」と伝えてもらえれば、こちらで `.webp` を作成する
   （E-04は背景の白を透明化する処理もあわせて行う）
3. 形式プレビュー4枚（1コマ/4コマ/ストーリー型/縦読み）は、**B節の #08〜#11**（汎用人物・
   マスコットなし）を別途生成する
4. コード側の反映（形式プレビューをCSS図形から実写画像に差し替え、CTAポスターに人物を合成）は、
   画像が揃った時点でこちらで対応する
