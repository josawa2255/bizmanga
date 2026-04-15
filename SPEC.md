# BizManga 仕様書

**ドメイン**: bizmanga.contentsx.jp
**リポジトリ**: [josawa2255/bizmanga](https://github.com/josawa2255/bizmanga)
**デプロイ**: GitHub Pages（CNAME: お名前.com）
**最終更新**: 2026-04-14

> このファイルは BizManga 単体の仕様を記録します。忘れがちな特殊動作・URLパラメータ・共通コンポーネント・外部連携を一箇所に集約しておき、将来のメンテ時に参照します。

---

## 1. ページ構成

| ページ | ファイル | 主要JS | 説明 |
|---|---|---|---|
| トップ | `index.html` | bm-i18n, bm-nav, bm-home, bm-hero, bm-hero-fx, bm-cta, bm-testimonials | Hero + ギャラリー + 制作過程 + CTA |
| 制作事例 | `works.html` | bm-works-page | カード一覧 + モーダル（ページング20件） |
| ビズ書庫 | `biz-library.html` | works.js | 全漫画アーカイブ + ブックビューア |
| 料金 | `pricing.html` | bm-pricing-quiz | プラン診断クイズ |
| FAQ | `faq.html` | — | 複数項目同時開閉対応 |
| お問い合わせ | `contact.html` | — | HubSpot Forms API連携 |
| プリプロ | `pre-production.html` | bm-pre-production | 制作過程カルーセル |
| お客様の声 | `testimonials.html` | bm-testimonials-page | WP連携 |
| 制作フロー | `index.html#flow` セクション | bm-flow | トップページのギャラリー後に統合。`production-flow.html` は `/#flow` への自動リダイレクトのみ |
| プライバシーポリシー | `privacy-policy.html` | — | |
| ニュース | `news.html` / `news-detail.html` | bm-wp-api | WP連携 |

## 2. URL パラメータ・特殊モード

### 2.0 制作事例の2系統URL（重要）

BizManga には**目的の異なる2種類の作品URL**が並列で存在する。使い分け必須。

| URL系統 | 例 | 用途 | 即時性 | ターゲット |
|---|---|---|---|---|
| **`?manga=id`** | `biz-library?manga=diamond` | 漫画ビューアを全画面で直接開く（QR/直リンク共有） | ✅ WP公開直後から動作 | 人間（顧客・商談先・QR経由） |
| **`/works/{slug}`** | `/works/diamond` | SEO向け静的な作品説明ページ（説明・ギャラリー・CTA） | ❌ 週1ビルド後（日曜03:00 JST） | Google / ChatGPT / Perplexity |

**動作メカニズム:**
- `?manga=id`: `biz-library.html` / `works.html` 共に `js/works.js` で URLSearchParams を読んで `isDirectMode` 分岐。WP API `/manga/{id}` でリアルタイム取得。新作品にも即時対応。
- `/works/{slug}`: [tools/build-works.py](tools/build-works.py) が WP API `/works` を叩いて事前生成する静的HTML。`.github/workflows/build-works.yml` で毎週日曜 03:00 JST 自動ビルド。

**運用ルール:**
- 新作品を顧客・商談で共有する時 → `?manga=id` を使う（即時）
- SEO流入を狙う時 → `/works/{slug}` が自動生成されるのを待つ or Actions から Run workflow で手動ビルド
- 両方のURLは恒久的に並列存在。どちらかに統合する予定はない

**よくある誤解:**
- ❌「新作品追加したら `/works/{slug}` も即使える」→ 日曜ビルドまで404
- ❌「`?manga=id` は旧仕様で廃止予定」→ 現役、QR運用の中核
- ✅「`works.html` の一覧は常に最新」→ JS が WP API から毎回取得するので新作品も即表示（ただしGoogleが読むのは日曜ビルド後）

### 2.1 QR コード用ダイレクトモード ⭐重要
```
https://bizmanga.contentsx.jp/biz-library?manga={manga-id}
```
- QRコードで直接特定の漫画を開くモード
- **動作**: 書庫UIを全て非表示 → 漫画ビューアのみ表示
- **制御**:
  - [biz-library.html:45](biz-library.html#L45) — `<head>` で即座に `<html class="direct-mode">` を付与（フリッカ防止）
  - [css/works.css](css/works.css) の `html.direct-mode` ルールでヘッダー/フッター/書庫UI非表示
  - [js/works.js](js/works.js) `isDirectMode` フラグで分岐
- **閉じるボタン (✕)**: ダイレクトモードでは非表示（CSS `display:none` + JSで早期return）
- **ESCキー**: ダイレクトモードでは無効
- **history.pushState**: ダイレクトモードでは呼ばない → ブラウザ戻る = 書庫ではなく前のアプリへ
- **closeManga()の挙動**: referrer が同一ホストなら back、なければ `./`（ホーム）へ
- **非公開作品のQRアクセス（限定公開運用）**: WP で全表示フラグを「表示しない」にしていても、`/manga/{id}` エンドポイント経由で取得可能
  - mangaData に無い場合、`fetch(api + '/manga/' + id)` で取得
  - 404なら「作品が見つかりませんでした」画面 + トップへ戻るリンク
  - これにより「ビズ書庫・ギャラリー・新作情報 全て非表示だがQR経由でだけ見せたい」運用が可能
- **完全非公開 (`cx_private`)**: WP管理画面の「🔒 完全非公開」で ON にすると、QR直リンクすらアクセス不可になる
  - `/works`, `/works-new`, `/library`, `/manga/{id}` すべてから除外
  - WP管理画面以外からは一切閲覧できない
  - 運用: 制作中・お蔵入り・クライアント契約切れなどで完全に閉じたい時

### 2.2 プラン事前選択
```
https://bizmanga.contentsx.jp/contact?plan={light|standard|premium}
```
- お問い合わせフォームのメッセージ欄に自動で「【〇〇プランについて】」プレースホルダ挿入
- [contact.html:144-149](contact.html) で処理

### 2.3 UTM / トラッキング
- `?utm_source=...` `?utm_medium=...` `?utm_campaign=...` `?source=...`
- contact フォーム送信時にメッセージ本文末尾に自動付加
- `[BizManga経由のお問い合わせ]` タグも必ず付与

## 3. 共通 JS コンポーネント

| ファイル | 役割 | 呼び出し方 |
|---|---|---|
| `js/bm-cta.js` | 共通CTAセクション生成 | `<section id="bmCtaMount"></section>` を置く |
| `js/bm-nav.js` | ヘッダーナビ + ハンバーガー + 言語切替 | 全ページで読込（defer） |
| `js/bm-i18n.js` | i18nエンジン | 全ページで読込（bm-nav.jsより先） |
| `js/bm-sanitize.js` | HTMLエスケープ + URL検証 | `window.bmSanitize.html()` / `.url()` |
| `js/bm-tracking.js` | ユーザー行動ログ | `window.bmGetTrackingNote()` で出力 |
| `js/bm-wp-api.js` | WP API クライアント | `window.BM_WORKS_DATA` 等をグローバル公開 |
| `js/bm-wp-config.js` | WP設定 | API baseURL / cache TTL |
| `sw.js` | Service Worker（表紙キャッシュ） | `index.html` / `biz-library.html` で登録 |

## 4. i18n 仕様

- **方式**: 2層構造（`data-ja`/`data-en` 属性 + `i18n/en.json` 辞書）
- **localStorageキー**: `bm-lang`
- **公開API**: `window.i18n` + `window.bmSwitchLang`（互換）
- **スクリプト読込順序（必須）**:
  ```html
  <script src="js/bm-i18n.js" defer></script>
  <script src="js/bm-nav.js" defer></script>
  ```
- **動的DOMの翻訳**: `window.i18n.translateAll()` を呼ぶ（英語モード時のみ）
- **注意**: `restoreAll()` 呼び出し時は `data-ja` 属性へフォールバックする。動的レンダリング後は必ず現在言語を確認してから `translateAll()` を呼ぶこと

## 5. 外部連携

| サービス | 用途 | 設定値 |
|---|---|---|
| HubSpot Forms | お問い合わせ送信 | Portal `48367061` / Form `b6da14d0-d60d-4357-89fc-0015ed32b704` |
| Google Analytics 4 | アクセス解析 | 測定ID `G-Q1T3033Q3W`（全HTMLの `<head>` に `gtag.js`、2026-04-16 設置） |
| WordPress REST API | 漫画事例 / ニュース / テスティモニアル | `https://cms.contentsx.jp/wp-json/contentsx/v1` |
| LINE 公式 | LINEで相談 | `https://line.me/R/ti/p/@626kzaze?oat_content=url&ts=01071831` |
| GitHub Pages | ホスティング | `bizmanga.contentsx.jp` (CNAME) |

### WP API エンドポイント
- `/works?site=bizmanga` — 全漫画事例
- `/works-new?site=bizmanga` — 新作漫画（ホームギャラリー用）
- `/library` — ビズ書庫全作品
- `/news?site=bizmanga&per_page=50` — ニュース一覧

### WP 編集可能フィールド
- `cx_title_en` / `cx_subtitle_ja` / `cx_subtitle_en`
- `cx_pages` / `cx_client` / `cx_point` / `cx_comment`
- `cx_sort_order` — 表示順（**数字が小さい＝先に表示**）
- `cx_show_gallery_bizmanga` — BizMangaギャラリー表示フラグ
- 表示順の運用ルール: N番に新作を挿入するとき、元のN番以降を `+1` ずつずらす（下から順に変更）

## 6. ヘッダー/ナビ仕様

### 6.1 モバイルヘッダー必須ルール ⭐再発防止
スマホでハンバーガーが押せない問題が過去に再発した履歴あり。**ヘッダー変更時は必ず以下を守る**:

1. `.bm-hamburger` に `order: 10` + `flex-shrink: 0` + `min-width/height: 48px` + `z-index: 99999`
2. 言語ボタンは `width: 40px; height: 32px` 程度に縮小
3. `.bm-header-right` は `gap: 8px` + `flex-wrap: nowrap` + `min-width: 0`
4. `.bm-header-inner` の padding は 16px 以下
5. `touchend` イベントも `click` と一緒に登録（iOS Safari対策）
6. **320px (iPhone SE) まで想定して計算**

### 6.2 ドロップダウン仕様
- PC: hover で展開
- モバイル: 1回目タップで展開、2回目タップで遷移（親リンクあり）
- ドロップダウン展開中は他のドロップダウンを自動で閉じる

## 7. ホームページ特殊動作

### 7.1 固定CTAバー
- [index.html:230-262](index.html) — LINE / お問い合わせ / 会社について知る の3ボタン
- hero を過ぎると出現（[index.html:346-361](index.html)）
- 全ボタンに **slide + tooltip** ホバーエフェクト
- 「会社について知る」は **SAHARA風** 波パルス演出（赤→オレンジグラデ + 内側ピンクピル）
- **モバイル**: 画面下の横並び固定バー、tooltip は非表示、box-reflect無効化
- フッターがバーに隠れないよう **モバイルで `body { padding-bottom: 60px }`**

### 7.2 ヒーロー
- `.bm-hero` 背景: `#000 url(hp-material-1.webp) center/cover fixed`（ContentsXと共有）
- タグライン「マンガの力でビジネスを動かす」— 1文字ずつ波シャイン
- 漫画表紙カルーセル5行 + マウスパララックス（PC）

## 8. 制作事例モーダル（works.html）

- **ページング**: 20件/ページ
- **モーダル操作**: クリック / スワイプ（スマホ）/ 矢印キー（PC）
- **縦読み判定**: 1ページ目の縦横比 < 0.2 で縦スクロールモードに自動切替
- **i18n**: モーダル内カテゴリ / メディア / UIテキストも翻訳対応

## 9. 漫画ビューア（works.js）

- **モード**: `spread`（見開き）/ `vertical`（縦スクロール）/ `vertical_only`（強制縦）
- **PCデフォルト**: spread
- **SPデフォルト**: vertical
- **ページ送り**: `waitForImage()` で画像読込完了を待ってからクリック解放
- **フラグ**: `isSpreadAnimating` でクリック入力をゲート

## 10. Service Worker

- [sw.js](sw.js) — Stale-While-Revalidate 戦略
- キャッシュ名: `bm-covers-v1`
- **キャッシュ対象**: `/material/manga/` / `/material/images/` / `/wp-content/uploads/`
- 初回: ネットワーク → キャッシュ保存、2回目以降: キャッシュから即返却

## 11. パフォーマンス最適化

- **Preload**: hero表紙6枚 (index), 3枚 (biz-library) を `<link rel="preload" as="image">`
- **dns-prefetch**: `cms.contentsx.jp`
- **preconnect**: フォント / WP API
- **Lazy load**: カルーセル複製分は `loading="lazy"`

## 12. セキュリティ対策

- [js/bm-sanitize.js](js/bm-sanitize.js):
  - `escapeHtml()` — XSS対策
  - `sanitizeUrl()` — 許可ドメインのみ（contentsx.jp / bizmanga.contentsx.jp / cms.contentsx.jp）
- **innerHTML代入前に必ず escape**

## 13. 既知の注意点

| 事項 | 詳細 |
|---|---|
| hreflang | **2026-04-14 全ページから削除済**（JS言語切替1URL構成のため誤実装だった。sitemap.xml からも削除） |
| image alt | ホーム hero のキャラ画像に alt が無い → アクセシビリティ改善余地 |
| image width/height | 未指定 → CLS悪化要因 |
| description | 現状63文字で短い。推奨 120-160字 |
| Organization.sameAs | **2026-04-14 `https://x.com/Bizmanga_` 追加済**。`parentOrganization.foundingDate: 2026-03-03` も追加 |
| OG画像 | 全ページ共通で `bizmanga-logo.webp` を流用中。1200×630px の専用OGP画像が未作成（TODO） |

### 2026-04-14 SEO改善実施

- hreflangタグを全HTML・sitemap.xmlから削除（誤実装解消）
- index.html のオフスクリーン h1（`left: -9999px`）を削除し、ヒーロータグライン `<p class="bm-hero-tagline">` を `<h1>` に昇格（視覚h1化）
- `<meta name="referrer" content="strict-origin-when-cross-origin">` を全ページに追加
- ルートに [llms.txt](llms.txt) を新設（AI検索エンジン向けサービス概要・主要ページ一覧）
- Organization スキーマに `sameAs: https://x.com/Bizmanga_` / `parentOrganization.foundingDate: 2026-03-03` を追加
- sitemap.xml に 4 ページ追加（strength / manga-types / use-cases / production-flow）
- pricing.html に `Service` + `Offer`（3プラン: 19,800 / 17,900 / 16,600円/P）JSON-LD を追加
- testimonials.html に `CollectionPage` JSON-LD を追加（レビューはJS動的描画のため AggregateRating は未付与）
- faq.html に `FAQPage` JSON-LD を追加（8 Q&A）
- 全ページに `BreadcrumbList` JSON-LD を追加
- 全ページに `twitter:site: @Bizmanga_` を追加
- works.html にSEO用静的イントロ（h1 + カテゴリリスト）を追加してJS依存によるクロール損失を緩和
- **works 静的SSG化**（タスク4）:
  - [tools/build-works.py](tools/build-works.py) 新設: WP API `/works` から取得し、`works.html` のBUILDマーカー間に静的カードを展開＋ItemList JSON-LD を挿入
  - [tools/templates/work-detail.html.tpl](tools/templates/work-detail.html.tpl) 新設: 個別作品ページテンプレ（BreadcrumbList + CreativeWork JSON-LD 付）
  - `works/{slug}.html` を19ページ自動生成（URL例: `https://bizmanga.contentsx.jp/works/diamond`）
  - `sitemap.xml` の `<!-- BUILD:WORKS -->` ブロックに個別URL 19件を自動追記
  - [js/bm-works-page.js](js/bm-works-page.js) を修正: 静的カード検出時は `grid.innerHTML=''` を回避し、click→モーダル のハンドラのみ付与（Cmd/Ctrl+Clickは個別ページへ遷移）
  - [.github/workflows/build-works.yml](.github/workflows/build-works.yml) 新設: 毎週日曜 03:00 JST 自動実行 + 手動トリガー可

### works 再ビルドルール

WordPress で works を追加・更新したら以下いずれか:

- **自動**: 毎週日曜 03:00 JST に GitHub Actions が走る
- **手動（即時）**: GitHub の Actions タブから "Build works static pages" → "Run workflow"
- **ローカル**: `python3 tools/build-works.py && git add works.html works/ sitemap.xml && git commit -m "chore(works): update" && git push`

## 14. 参照ドキュメント

| ファイル | 内容 |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Claude Code 引き継ぎ資料 |
| [../SPEC.md](../SPEC.md) | プロジェクト全体仕様（B/C横断） |
| [../STYLE-GUIDE.md](../STYLE-GUIDE.md) | デザインルール |
| [../COMPONENT.md](../COMPONENT.md) | 再利用UIパーツ |
| [../SEO.md](../SEO.md) | SEOメタデータ一覧 |
| [../CHECKLIST.md](../CHECKLIST.md) | 公開前チェックリスト |

## 15. よくある落とし穴（Gotchas）

1. **WP側で漫画事例を編集しても反映されない** → `/works` と `/works-new` は別エンドポイント。ホームギャラリーは `/works` 優先（ [bm-home.js:137-149](js/bm-home.js)）
2. **英語切替が動かない** → `bm-i18n.js` が `bm-nav.js` より先に読み込まれているか確認
3. **モバイルでハンバーガー押せない** → §6.1 のチェックリスト
4. **QRダイレクトモードで書庫に迷い込む** → §2.1 の仕組みで閉じる/ESC/履歴追加が全て封じられている
5. **表示順の重複** → `cx_sort_order` が同数字だと投稿日順になって不安定 → §5 の運用ルール参照
6. **CTAセクション変更** → [js/bm-cta.js](js/bm-cta.js) 1箇所を編集すれば全ページ反映
