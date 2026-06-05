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
- `bm-pricing-quiz.js` → `i18n.t()` で翻訳取得
- `bm-works-page.js` → CATEGORY_EN, MEDIA_EN マップ + data-ja/data-en動的セット
- `works.js` → CATEGORY_EN_MAP + filter/card/modal/viewer UI の i18n

## ページ構成

⭐ **ページ一覧の正は [SPEC.md §1](SPEC.md) の表**（本表は主要ページの抜粋）。全HTML（27本）の構成・章立て・LP一覧はそちらを参照。全ページ共通で `bm-i18n.js` + `bm-nav.js` を読込む（以下「主要JS」はページ固有分のみ）。

| ページ | ファイル | ページ固有の主要JS |
|--------|---------|--------|
| トップ | index.html | bm-home.js, bm-hero.js, bm-hero-fx.js, bm-pre-production.js, bm-s3d-screens.js, bm-flow.js |
| 制作事例 | works.html | bm-works-page.js |
| ビズ書庫 | biz-library.html | works.js |
| 料金 | pricing.html | bm-pricing-quiz.js |
| FAQ | faq.html | （なし） |
| お問い合わせ | contact.html | bm-hubspot.js |
| お客様の声 | testimonials.html | bm-testimonials-page.js |
| コラム一覧/詳細 | column.html / column-detail.html | bm-wp-api.js |
| ニュース | news.html / news-detail.html | bm-wp-api.js |
| 漫画制作会社 比較ガイド | manga-production-company.html | mpc.js, mpc-scale.js, bm-fuwa.js |
| 用途別LP 8本 | product/recruit/sales/training/company/inbound/ir-manga.html, manga-ad-lp.html | （recruitのみ bm-lp-v2.js） |
| その他 | strength / use-cases / manga-types / pricing / privacy-policy / 404 / embed-viewer | 各ページ固有JS |

> 注: 旧 `pre-production.html` / `gallery.html` / `production-flow.html` は廃止済み（index.html に統合 or 削除）。存在しないので新規リンクしないこと。

## FAQ アコーディオン（faq.html）
- 複数項目の同時開きに対応済み（`classList.toggle('open')`）
- 以前: 一つ開くと他が閉じる排他パターン → 現在: 各項目独立で開閉

## 制作事例モーダル（works.html + index.html）
- タイトル+カテゴリタグ: `.work-detail-title-row` でflexbox横並び
- カルーセル: 1ページ目の縦横比で縦読み(vertical-scroll)/カルーセル切替
- フィルター: カテゴリ別絞り込み + カウント表示

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
