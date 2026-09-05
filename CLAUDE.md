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
| 強み | strength.html | （**2026-08-05 v2デザインへ統一**: bm-lp-v2.css/js + アドオン css/strength.css（`body.str-v2` スコープ）。ヒーローは product-manga / manga-ad-lp と同型。旧 bm-strength.js は廃止。画像プロンプトは docs/strength-image-prompts.md。**2026-08-19** 「5つの強み」をコマ割りパネル `.str-panels`、「お悩み」を数字中心の横並び行 `.str-pain` に刷新。EN時は `html[lang="en"]` で装飾と大きな数値を調整） |
| マンガの種類 | manga-types.html | bm-manga-types.js（**2026-08-24 「7つの物語を巡る」エディトリアル版へ全面刷新**: 2026-08-19版の LP v2 流用構成（recruit-hero-v2ヒーロー+7ジャンルmerit-cardグリッド+quickfind早見表+黒bridge+黒END）を廃止。共通トークン `css/bm-lp-v2.css` の上に、ページ固有パーツを `css/manga-types.css`（`body.mt-v2` スコープ、`mt-*` 名前空間）で全面再実装。**大きな黒背景を使わず、白 / 生成り `--lpv2-cream` / オレンジ `--lpv2-accent` の3色構成**。構成: Hero（左=パンくず+SEVEN BUSINESS STORIES+明朝の大見出し「企業の数だけ、伝えるべき物語がある。」、右=公式キャラ `material/images/character.webp` + 吹き出し。背景は白→生成りグラデ+薄いオレンジの巨大「07」+細い斜線。**2026-08-24 追加強化（「質素」との指摘を受けて）: 見出しを 58px→76px に拡大し `em` に薄橙の下敷き+下線、キャラを 620px→700px（元画像 352x927 なので拡大なし）+足元に生成りの土台、「07」を塗り+輪郭のグラフィックに、`.mt-hero-frame` で映画のフレーム枠（四隅トンボ付き。hero-inner の内側に置くので索引帯を横切らない）、ヒーロー下端に `.mt-hero-index`（CHAPTER INDEX = 7章への直リンク帯。PC 7列 / ~1100px 4列 / ~820px 2列）を新設**）→CHAPTERS 01–07「7つの物語を巡る」（左=7章の横長リスト `button.mt-chapter-row`／右=選択中の詳細 `article.mt-chapter-panel`。切替は `js/bm-manga-types.js`、`aria-pressed` + `aria-live="polite"`、↑↓←→キー対応、`#mt-recruit` 等のハッシュ深リンク対応。**JS無効時は7章すべてが縦に並ぶ**＝コンテナに `.is-js` が付いたときだけ非選択章をCSSで隠す設計）→相談セクション（生成り背景。**2026-08-24 追加強化: 平坦な帯だったのを白い「招待状」パネル `.mt-consult-panel`（上辺4pxオレンジ）に作り替え、見出し 40px→42px + `em` に下敷き、サイト共通の既存表記を並べた数値3件`.mt-consult-facts`（30分オンライン無料相談 / 1ページから発注可能 / 0円・発注義務なし）、相談導線3つ（フォーム + LINE + 電話 `.mt-consult-tel`）を追加**。右から `character-cta.webp` が吹き出し付きで上半身だけのぞく。**キャラはヒーローと別カットの2種類のみ**。SPは吹き出しを全幅にしてキャラをその下に右寄せ）→形式4つ 1コマ/4コマ/ストーリー型/縦読み（`.mt-format-list`、カードではなく細い境界線で区切る編集的レイアウト。SPは2列）→FAQ（`lpv2-faq` 流用、FAQPage JSON-LDと同一文言）→RELATED（用途別LP 8本、`lpv2-related` 流用）→最終CTA `.mt-cta`。**白抜き文字を敷く面はすべて `--lpv2-accent-deep` #b94100**（最終CTA / 選択中の章行 `.mt-chapter-row.is-active` / `.mt-btn--primary`。`--lpv2-accent` #e85500 に白文字だと 3.66:1 で WCAG AA 未達のため、新色を作らず既存トークンで 5.50:1 を確保）。**小さいオレンジ文字（18.66px未満）も同トークンに統一**（ラベル・番号・本文中リンク等。大きい見出しの `em` と `.mt-consult-facts__num` は大文字サイズ基準 3:1 を満たすので #e85500 のまま）。このページ限定で `lpv2-guide__eyebrow` / `lpv2-related-card__num` / `__arrow` も `.mt-v2` スコープで上書き（共通 `bm-lp-v2.css` は他8LPに影響するので触らない）。**残る AA 未達は共通フッターの3件のみ**（`.bm-footer-address` / copyright / `.bm-footer-parent` = `css/bizmanga.css`・全27ページ共有のため未対応）。7ジャンルの挿絵 `images/manga-types/type-*.png` は章詳細パネルの上部バンドに流用。**`images/manga-types/format-{1koma,4koma,story}.png` は形式セクションのテキスト化により未参照になった**（ファイルは削除せず残置）。画像プロンプトは docs/manga-types-image-prompts.md） |
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
