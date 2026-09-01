# BizManga (bizmanga.contentsx.jp) — Claude Code 引き継ぎ資料

## リポジトリ
- GitHub: `josawa2255/bizmanga`
- デプロイ先: GitHub Pages → bizmanga.contentsx.jp
- DNS: お名前.com（CNAME）

## i18n（日英切替）システム

### アーキテクチャ（2層構造）
1. **JSON辞書** `i18n/en.json`（約228エントリ・随時増加）: テキストノード走査で日本語→英語に自動置換
2. **data属性** `data-ja` / `data-en`: HTML要素に直接付与。JSON辞書より優先

### 主要ファイル
- `js/bm-i18n.js` — i18nエンジン本体
- `i18n/en.json` — 翻訳辞書
- `js/bm-nav.js` — `switchLang()` は `window.i18n.switchLang()` に委譲。未ロード時はfallbackで直接走査

### 設定値
- localStorageキー: `bm-lang`
- 言語ボタンクラス: `.bm-lang-btn`
- パブリックAPI: `window.i18n` + `window.bmSwitchLang`（互換エイリアス）

### スクリプト読込順序（必須）
```html
<script src="js/bm-i18n.js" defer></script>
<script src="js/bm-nav.js" defer></script>
```
bm-i18n.js → bm-nav.js の順序が必須。全ページ（27 HTML）に適用済み。

### JS側のi18n対応パターン
```javascript
// 動的レンダリング後
if (window.i18n && window.i18n.translateAll) {
  window.i18n.translateAll();
} else if (typeof window.bmSwitchLang === 'function') {
  window.bmSwitchLang('en');
}
```

### i18n対応済みJS
- `bm-testimonials.js`, `bm-home.js`, `bm-pre-production.js` → translateAll()パターン
- `bm-works-page.js` → CATEGORY_EN, MEDIA_EN マップ + data-ja/data-en動的セット
- `works.js` → CATEGORY_EN_MAP + filter/card/modal/viewer UI の i18n

## ページ構成

⭐ **ページ一覧の正は [SPEC.md §1](SPEC.md) の表**（本表は主要ページの抜粋）。全HTML（27本）の構成・章立て・LP一覧はそちらを参照。全ページ共通で `bm-i18n.js` + `bm-nav.js` を読込む（以下「主要JS」はページ固有分のみ）。

| ページ | ファイル | ページ固有の主要JS |
|--------|---------|--------|
| トップ | index.html | bm-home.js, bm-hero.js, bm-hero-fx.js, bm-pre-production.js, bm-s3d-screens.js, bm-flow.js |
| 制作事例 | works.html | bm-works-page.js |
| ビズ書庫 | biz-library.html | works.js |
| 料金 | pricing.html | （なし。2プランカード型料金表〈フル漫画家/ハイブリッド〉、2026-08-19刷新） |
| FAQ | faq.html | （なし） |
| お問い合わせ | contact.html | bm-hubspot.js |
| お客様の声 | testimonials.html | bm-testimonials-page.js |
| コラム一覧/詳細 | column.html / column-detail.html | bm-wp-api.js |
| ニュース | news.html / news-detail.html | bm-wp-api.js |
| 漫画制作会社 比較ガイド | manga-production-company.html | mpc.js, mpc-scale.js, bm-fuwa.js |
| 用途別LP 8本 | product/recruit/sales/training/company/inbound/ir-manga.html, manga-ad-lp.html | （**全8本v2デザイン統一済**: bm-lp-v2.css/js。lpv2-*構造・hero_LP流用ヒーロー・関連7枚。recruitが型の正本） |
| 強み | strength.html | （**2026-08-05 v2デザインへ統一**: bm-lp-v2.css/js + アドオン css/strength.css（`body.str-v2` スコープ）。ヒーローは product-manga / manga-ad-lp と同型。旧 bm-strength.js は廃止。画像プロンプトは docs/strength-image-prompts.md） |
| マンガの種類 | manga-types.html | bm-manga-types.js（**2026-08-31 「企業の物語を上映する映画館」版へ全面リデザイン**: 2026-08-24版の「7つの物語を巡る」ヒーロー（キャラ+吹き出し+チャプター索引帯）を廃止し、予告編→本編→上映形式→上映後トーク→上映作品→次回作の制作会議、という映画館の上映体験に統一。**CHAPTERS 01–07（章名7つ・デザイン・操作方法）、相談セクション、RELATED 8LP、全リンク/電話/LINEは変更なし**。構成: ①**PROLOGUE**（`.mt-hero`。英字ラベル PROLOGUE/00、見出し「御社の『伝わらない』を、物語の予告編に。」、右に3コマ予告編 `.mt-hero-trailer`〈フィルムセル調 `.mt-trailer-frame`×3、中身は実写未定のためインラインSVGピクトグラム（吹き出し+×→電球→吹き出し+チェック）で仮組み。差し替え案は docs/manga-types-image-prompts.md C-1節〉、CTA「プロローグから物語を選ぶ」は#chaptersへスムーズスクロール）→①b **BRIDGE**（`.mt-bridge`。大きな帯ではなく「PROLOGUE END — 7つの物語から、本編を選ぶ」の1行のみ。黒背景不使用）→②CHAPTERS 01–07（現行維持）→③相談セクション（現行維持）→④**SCREENING FORMAT**（`#formats`。旧・罫線区切りの4列テキストを**上映プログラムのチケットUI**に刷新: 左に4枚のチケット状ボタン`button.mt-ticket`（もぎり跡`::before/::after`、選択中はaccent-deep枠+チェック）、右に詳細`article.mt-ticket-panel`（プレビューは**画像不使用、CSSのみ**`.mt-ticket-preview--{teaser,short,feature,mobile}`で1コマ/4コマ/ストーリー型/縦読みのコマ割りを表現、+推奨ページ数/主な掲載場所/おすすめの組み合わせ1件）。デフォルトは**03 ストーリー型**。章セレクタと同じ設計で`bm-manga-types.js`の`initFormats()`が担当（JS無効時は4形式とも縦並び）。**注意**: 実際のflexアイテムは`.mt-ticket-list > li`であり`button.mt-ticket`ではないため、レスポンシブ列数指定は`li`側に付ける（button側に付けると列数が崩れる）→⑤**AFTER TALK / Q&A**（`#faq`。lpv2-faq流用、`.lpv2-eyebrow`で英字ラベル追加、質問4つを刷新しFAQPage JSON-LDも同期）→⑥**NOW SHOWING**（`lpv2-related`流用、英字ラベル追加、カード上辺に4pxオレンジバーでポスター調）→⑦**NEXT PRODUCTION MEETING**（`.mt-cta`。2カラム化し右にCSS/HTMLのみのCOMING NEXTポスター`.mt-cta-poster`〈シルエットはCSS図形のみ、文字は全てHTML〉を追加）。3ブレークポイントでPlaywright検証済み・コンソールエラーなし。画像プロンプトはdocs/manga-types-image-prompts.md） | **2026-08-31 追加調整（ダーク背景化は行わず、既存の白/生成り/オレンジ基調のまま微調整）**: ①相談セクションのラベル/見出しを「INTERMISSION / STORY CONSULTATION」「次のチャプターに迷ったら、課題だけ聞かせてください。」に変更（レイアウト・数値・CTAは維持）。②予告編3コマを実写差し替え前提の構造に変更（`.mt-trailer-frame__art`固定アスペクト3:2＋`.mt-trailer-frame__glyph`がimg差し替えでobject-fit:coverになる設計。推奨ファイル名`trailer-{01-problem,02-idea,03-result}.png/webp`はdocs/manga-types-image-prompts.md C-1節）。③SCREENING FORMATのプレビューに効果音「パッ！」・短いキャッチコピー・起承転結の吹き出し・変化を示す2点等を追加し「マンガの仮ネーム」寄りに強化、形式切替時に150〜180msのopacity+translateフェード（prefers-reduced-motionで無効化）。④NOW SHOWINGのカードをaspect-ratio 4/5の縦長ポスターに変更し番号表記を「FILM 0X」に、右上に控えめな網点円モチーフを追加。⑤旧`lpv2-sr-only`の非表示SEO文言を可視の`.mt-hero-kicker`に変更し、退役したH1文言「企業の数だけ、伝えるべき物語がある。」をCHAPTERSセクションのリード文に自然に配置。meta title/description/canonical/構造化データは無変更。フローティングCTAとの重なりはPlaywrightで4幅（1440/820/375/320）検証し問題なし。
| 活用場面 | use-cases.html | js/bm-use-cases.js（**2026-08-24 「10の接点を巡る」エディトリアル版へ全面刷新**: 未コミット・作業中〈ブランチ `feat/manga-types-redesign`〉。2026-08-21版のLP v2流用構成（統計バー+4問クイズ+3列カード`.uc-scene-grid`+KPIストリップ）を廃止し、先行実装した [[manga-types.html]] の「7つの物語を巡る」章選択UIと同じ設計思想でページ固有パーツを `css/use-cases.css`（`body.uc-v2` スコープ、`uc-*` 名前空間）に全面再実装。構成: Hero（左=コピー、右=公式キャラ）→TOUCHPOINTS 01–10（左に9場面の横長リスト `button.uc-scene-row`〈名刺/HP・LP(02–03)/SNS/採用面接/サプライズ/マニュアル/提案資料/メルマガ/展示会〉、右に選択中の詳細 `article.uc-scene-panel`。切替は `js/bm-use-cases.js` が `aria-pressed` + `aria-live="polite"` で担当、`#uc-meishi` 等のハッシュ深リンク対応、**JS無効時は9グループすべて縦並びで残る**設計は `js/bm-manga-types.js` と同じ）→ONE STORY, MANY TOUCHPOINTS（`.uc-spread`、中心の「1 STORY」から6接点へ細線で分岐する図）→WHY MANGA WORKS（`.uc-why`、効果データ `.uc-why-data` 付きの本文プローズ、BtoBコラム3本・比較ガイドへの内部リンクは維持）→FAQ(4問)→RELATED(用途別LP 8本)→END CTA `.uc-cta`。**白抜き文字を敷く面・小さいオレンジ文字（18.66px未満）はすべて `--uc-accent-deep` に統一**（`.uc-btn--primary`/選択中の場面行 `.uc-scene-row.is-active`/各種ラベル・番号・本文中リンク等。`--uc-accent` #e85500 に白文字だと3.95:1でWCAG AA未達のため、manga-types.html で確立した既存トークンで5.50:1を確保。このページ限定で `lpv2-guide__eyebrow`/`lpv2-related-card__num`/`__arrow` も `.uc-v2` スコープで上書き）。9シーンの挿絵 `material/images/use-cases/*.webp` は当初チビキャラ風の独自画風（既存画像を流用）だったが、他ページとのブランド統一のため水彩+ink画風（manga-types/strength/recruit-manga系）へ**作り直し予定**。画像プロンプトは docs/use-cases-image-prompts.md（9シーン: 名刺/HP・LP/SNS/採用面接/サプライズ/マニュアル/提案資料/メルマガ/展示会。ChatGPTでの生成はユーザーが実施）） |
| その他 | pricing / privacy-policy / 404 / embed-viewer | 各ページ固有JS |

> 注: 旧 `pre-production.html` / `gallery.html` / `production-flow.html` は廃止済み（index.html に統合 or 削除）。存在しないので新規リンクしないこと。

## FAQ アコーディオン（faq.html）
- 複数項目の同時開きに対応済み（`classList.toggle('open')`）
- 以前: 一つ開くと他が閉じる排他パターン → 現在: 各項目独立で開閉

## 制作事例モーダル（works.html + index.html）
- タイトル+カテゴリタグ: `.work-detail-title-row` でflexbox横並び
- カルーセル: 1ページ目の縦横比で縦読み(vertical-scroll)/カルーセル切替
- フィルター: カテゴリ別絞り込み + カウント表示
- ⚠️ **同じDOMが index.html と works.html の2箇所にあり、動かすJSは別**（index=`js/bm-hero.js` / works=`js/bm-works-page.js`）。挙動を変えるときは**必ず両方**直す
- **スマホ縦読みは上下2ペイン分割**（上=漫画/下=詳細、読んでいる側が広がる）。`js/bm-wd-split.js` が担当。詳細は [SPEC.md §8.1](SPEC.md)

## 漫画ビューア（js/works.js）
- 見開き(spread)/縦スクロール(vertical)/強制縦(vertical_only) の3モード
- PCデフォルト: spread、SPデフォルト: vertical
- ページ送り: `waitForImage()` で画像読み込み完了を待ってからフラグ解除
- `isSpreadAnimating` フラグでクリック入力をゲート

## 外部サービス
- HubSpot: Portal 48367061（ContentsXと共通）
- WordPress API: `https://cms.contentsx.jp/wp-json/contentsx/v1`（bm-wp-config.js）

## GSC日次ランク追跡（2026-04-20〜稼働）
- 毎朝 JST 09:00 に `.github/workflows/rank-tracker.yml` が自動発火
- `tools/rank-tracker.py` が GSC Search Analytics API を叩き、ターゲットKW（新設時12件→現在約40件。BtoBマンガ/ビジネスマンガ 制作/採用マンガ/漫画制作会社など）の順位を取得
- 結果は `tools/rank-history.jsonl` に1行追記されて自動commit
- B + C 両サイト対応（`SITES` に両URL登録）
- 必要Secrets: `GSC_CLIENT_ID` / `GSC_CLIENT_SECRET` / `GSC_REFRESH_TOKEN`（登録済み）
- 追跡KW追加は `TARGET_QUERIES` 配列を編集

## Python自動翻訳ツール
`tools/i18n-build.py`:
- HTML/JSから日本語テキストを自動抽出
- 既存のen.jsonとマージ
- `--auto-translate` でGoogle Translate APIによる自動翻訳
- `--dry-run` `--report` オプション対応

## 履歴メモ
- i18nシステム / works i18n / 見開きデフォルト / ページ送り修正 / FAQ複数開き は **対応済み・push済み**（旧「未完了タスク」記述を2026-06-05に解消）
- CORS は **解決済み**（WP API は本番からアクセス可。詳細は memory `project_cors_issue`）
- 最新の仕様・変更履歴は [SPEC.md](SPEC.md)、過去バグと再発防止は [../BUGS.md](../BUGS.md) を参照
