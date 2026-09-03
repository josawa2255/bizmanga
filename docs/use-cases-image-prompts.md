# 活用場面ページ（/use-cases）画像生成プロンプト集

ChatGPT **Image 2.0** 用のプロンプトです。現在 `material/images/use-cases/` に入っている9枚は、
チビキャラ風の独自画風（オレンジベストの女の子が全カード共通で登場する既存イラスト）です。
これを、**manga-types / strength / recruit-manga と同じ「水彩+ink」の大人キャラ画風**に
作り直します。本番の画像を**同名で上書き保存**してください（差し替えるだけでページに反映されます）。

## 全体の流れ

ChatGPTの**同じチャット**の中で、メッセージを**合計10通**送ります。

| 送信 | 内容 | このページの場所 |
|---|---|---|
| 1通目 | 画風を指定する文章（+画像2枚を添付） | [下の「送信1」](#送信1画風指定--最初に1回だけ) |
| 2〜10通目 | 9シーンそれぞれの絵の内容（1枚＝1通） | [下の「9シーン」#01〜#09](#9シーン9枚) |

チャットを分けると画風の記憶が切れてしまうので、**10通とも同じチャットで**続けて送ってください。

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
これから9枚のイラストを作ります。すべてこの2枚と同じ画風・配色・線のタッチに
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

## 送信2〜10（9枚の絵の内容）— #01から#09まで順番に

下に **#01〜#09** の9個のプロンプトが並んでいます。**1個ずつ、送信1と同じチャットに**貼り付けて送信してください。1通送るごとに1枚の画像が生成されます。

各プロンプトについて、コピーするのは以下の**灰色の枠の中身だけ**です。

- ❌ コピー不要: 見出し行（`### #01 保存パス: ...`）
- ✅ コピーする: その直下の ```` ``` ```` 〜 ```` ``` ```` で囲まれた英文だけ

生成されたPNG画像は、見出しに書かれている**保存パスのファイル名で** `material/images/use-cases/` に**上書き保存**してください（例: #01なら `meishi.png`）。

> **WebP変換について**: PNGを保存したら、ファイル名と一緒に「PNG保存したので.webpも作ってください」とこちらに伝えてもらえれば、こちらで既存の `meishi.webp` 等と同じファイル名で `.webp` を作成します（HTML側は `.webp` を参照しているため、拡張子を揃える必要があります）。手元にツールを用意する必要はありません。

### 生成サイズ

全9枚とも ChatGPTに **横長 1536×1024** で生成するよう指定してください（プロンプト冒頭にすでに書いてあります）。CSS側で16:10に中央トリミングされるため、**絵の主要な要素は中央80%に収めてください**（プロンプト内にもその指示が入っています）。

### 似なかったときの修正文

生成結果が画風から3点ずれやすいことが分かっています。ズレていたら、[docs/strength-image-prompts.md](strength-image-prompts.md) の「似なかったときの修正文」セクションの枠の中身をそのままコピーしてChatGPTに送ってください（内容は今回も共通で使えます）。

---

## 9シーン（9枚）

「活用シーン10選」グリッド（#01〜#09。名刺・HP-LP・SNS・採用面接・サプライズ・マニュアル・提案資料・メルマガ・展示会）に使う挿絵です。

### #01 保存パス: `material/images/use-cases/meishi.png` — 名刺

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

Scene: two Japanese business people in their 30s exchange business cards with a slight
bow, one man in a navy suit offering his card with both hands, one woman in a light
gray-blue blazer receiving it with a pleased smile. The cards are drawn as small plain
pale rectangles (do not draw any text on them). A short orange sparkle marks the moment
of the exchange between their hands.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #02 保存パス: `material/images/use-cases/hp-lp.png` — HP・LP

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

Scene: a young Japanese woman in her 20s sits at a light wooden desk, looking at a
laptop screen with a curious, engaged expression, one hand resting near the trackpad.
The laptop screen is drawn as a plain pale-blue-gray rectangle divided into simple
rounded blocks suggesting a webpage layout (do not draw any text or icons inside it).
A short orange stroke highlights the corner of the screen to suggest attention.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #03 保存パス: `material/images/use-cases/sns.png` — SNS

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

Scene: a young Japanese person in casual clothes holds a smartphone up at chest height
with both thumbs poised over the screen, smiling brightly as if just posting something.
Around the phone, drawn as faint pale-blue watercolor shapes, a few simple rounded
speech-bubble-like outlines float upward (do not draw any text, hearts, or icons inside
them — keep them plain empty outlines). A short orange spark sits near the top of the
phone to suggest a notification.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #04 保存パス: `material/images/use-cases/saiyo.png` — 採用面接

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

Scene: across a simple meeting table, a Japanese interviewer in his 30s in a navy suit
sits calmly with an open booklet in front of him, gesturing gently with one hand as he
speaks. Opposite him, a job candidate in her 20s, in a light gray blazer, listens with
a relaxed, hopeful expression. A short orange stroke highlights near the open booklet
between them.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #05 保存パス: `material/images/use-cases/surprise.png` — サプライズ

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

Scene: a Japanese office worker in her 40s holds a closed, slightly thick hardcover
booklet with both hands at chest height, looking down at it with a surprised, touched
expression, as if just receiving it as a gift. Behind her, a faint pale-blue watercolor
cloud shows a few soft ribbon-like curls drifting, like gift wrapping. A short orange
stroke highlights near the corner of the booklet.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #06 保存パス: `material/images/use-cases/manual.png` — マニュアル

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

Scene: a Japanese factory worker in his 20s, wearing a simple orange hard hat and light
work jacket, stands beside a plain gray machine console, holding an open booklet in one
hand and pointing at the machine with the other, focused and attentive. A short orange
stroke highlights a small warning-triangle-like shape on the console (kept plain, no
text or symbols inside it).

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #07 保存パス: `material/images/use-cases/teian.png` — 提案資料

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

Scene: a Japanese salesperson in his 30s, in a navy suit, sits at a desk turning an open
booklet toward the viewer with both hands, presenting it with a confident, persuasive
expression, as if pitching to a client across the table. A short orange stroke
highlights near the edge of the booklet page.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #08 保存パス: `material/images/use-cases/merumaga.png` — メルマガ

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

Scene: a Japanese marketing woman in her 20s sits at a desktop computer, one hand on the
mouse, looking at the monitor with a satisfied smile as if checking results. The monitor
screen is drawn as a plain pale-blue-gray rectangle with a simple rounded envelope-like
shape in the center (do not draw any text inside it). A short orange stroke highlights
the corner of the envelope shape.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

### #09 保存パス: `material/images/use-cases/tenjikai.png` — 展示会

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

Scene: at a simple exhibition booth, a Japanese staff member in her 20s, wearing a light
gray-blue polo shirt, hands a plain booklet across a low counter to a visitor (seen from
behind, out of focus), both smiling warmly. Behind her, a faint pale-blue watercolor
silhouette suggests a simple banner stand shape (do not draw any text or logo on it). A
short orange stroke highlights near the booklet being handed over.

Keep all key elements within the central 80% of the frame. Not flat vector, not
icon-style, not corporate clip art, not photorealistic.
Absolutely no text, no numbers, no letters, no logos anywhere in the image.
```

---

## 生成しないもの（既存流用）

| 用途 | 参照先 | 理由 |
|---|---|---|
| ヒーロー背景 | `material/images/lp/recruit-hero-v2.webp` / `-sp.webp` | 商品紹介マンガ・強み・マンガ広告・マンガの種類と**同一画像**。トップの見た目を揃えるための流用。新規生成は不要 |
| OG 画像 | `material/images/og/og-use-cases.webp` | 既存のまま。新規生成は不要 |

新規カットを足すときは**必ず recruit-manga の画像を基準**にしてください（サイト全体の画風の正本）。
