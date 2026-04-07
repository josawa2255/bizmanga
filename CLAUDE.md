# BizManga (bizmanga.contentsx.jp) — Claude Code 引き継ぎ資料

## リポジトリ
- GitHub: `josawa2255/bizmanga`
- デプロイ先: GitHub Pages → bizmanga.contentsx.jp
- DNS: お名前.com（CNAME）

## i18n（日英切替）システム

### アーキテクチャ（2層構造）
1. **JSON辞書** `i18n/en.json`（238+エントリ）: テキストノード走査で日本語→英語に自動置換
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
bm-i18n.js → bm-nav.js の順序が必須。全9ページに適用済み。

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

| ページ | ファイル | 主要JS |
|--------|---------|--------|
| トップ | index.html | bm-opening.js, bm-i18n.js, bm-nav.js, bm-home.js, bm-hero.js |
| 制作事例 | works.html | bm-i18n.js, bm-nav.js, bm-works-page.js |
| ビズ書庫 | biz-library.html | bm-i18n.js, bm-nav.js, works.js |
| 料金 | pricing.html | bm-i18n.js, bm-nav.js, bm-pricing-quiz.js |
| FAQ | faq.html | bm-i18n.js, bm-nav.js |
| お問い合わせ | contact.html | bm-i18n.js, bm-nav.js |
| プリプロ | pre-production.html | bm-i18n.js, bm-nav.js, bm-pre-production.js |
| お客様の声 | testimonials.html | bm-i18n.js, bm-nav.js, bm-testimonials.js |
| ギャラリー | gallery.html | bm-i18n.js, bm-nav.js |

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

## Python自動翻訳ツール
`tools/i18n-build.py`:
- HTML/JSから日本語テキストを自動抽出
- 既存のen.jsonとマージ
- `--auto-translate` でGoogle Translate APIによる自動翻訳
- `--dry-run` `--report` オプション対応

## 未完了タスク
- git push 未実施（i18nシステム、works i18n、見開きデフォルト、ページ送り修正、FAQ複数開き）
- CORS修正: WPプラグインをcms.contentsx.jpサーバーにファイルマネージャーでアップロード必要
