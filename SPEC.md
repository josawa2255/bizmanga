# BizManga 仕様書

**ドメイン**: bizmanga.contentsx.jp
**リポジトリ**: [josawa2255/bizmanga](https://github.com/josawa2255/bizmanga)
**デプロイ**: GitHub Pages（CNAME: お名前.com）
**最終更新**: 2026-05-13

> このファイルは BizManga 単体の仕様を記録します。忘れがちな特殊動作・URLパラメータ・共通コンポーネント・外部連携を一箇所に集約しておき、将来のメンテ時に参照します。

---

## 1. ページ構成

| ページ | ファイル | 主要JS | 説明 |
|---|---|---|---|
| トップ | `index.html` | bm-i18n, bm-nav, bm-home, bm-hero, bm-hero-fx, bm-cta, bm-testimonials | Hero + ギャラリー + 制作過程 + CTA |
| 制作事例 | `works.html` | bm-works-page | カード一覧 + モーダル（ページング20件） |
| ビズ書庫 | `biz-library.html` | works.js | 全漫画アーカイブ + ブックビューア |
| 料金 | `pricing.html` | bm-pricing-quiz | プラン診断クイズ + 詳細トグル内: 01単価・割引 / 02オプション / 03含まれるもの / 04カラーリング / 05他社との比較 |
| FAQ | `faq.html` | — | 複数項目同時開閉対応 |
| お問い合わせ | `contact.html` | — | HubSpot Forms API連携 |
| プリプロ | `pre-production.html` | bm-pre-production | 制作過程カルーセル |
| お客様の声 | `testimonials.html` | bm-testimonials-page | WP連携 |
| 制作フロー | `index.html#flow` セクション | bm-flow | トップページのギャラリー後に統合。`production-flow.html` は `/#flow` への自動リダイレクトのみ |
| プライバシーポリシー | `privacy-policy.html` | — | 個人情報保護法準拠。11条構成（事業者情報・取得情報・利用目的・第三者提供・外部サービス連携・安全管理措置・開示請求・Cookie・未成年・改定・窓口）。i18n対応。全ページフッターからリンク |
| ニュース | `news.html` / `news-detail.html` | bm-wp-api | WP連携 |
| コラム一覧 | `column.html` | bm-wp-api | カードグリッド3列。`/columns?site=bizmanga` から取得。ホームにも横スクロール枠あり |
| コラム詳細(動的) | `column-detail.html` | インラインJS | `?id={post_id}` で WP API `/columns/{id}` から取得。目次自動生成・関連記事・日英切替・OGP動的更新。Editorial Magazineデザイン |
| コラム詳細(静的SEO) | `column/{slug}.html` | GitHub Actions | `tools/build-columns.py` で自動生成。Article JSON-LD・OGP・GA4完備。週1 + 手動実行。**目次自動生成**: 本文の `<h2>` をパースして `id="sec-N"` 付与+`<nav class="bm-col-toc">` を hero 直下に挿入。h2が2個未満なら目次非表示。CSSは [tools/templates/column-detail.html.tpl](tools/templates/column-detail.html.tpl) 内、番号は `decimal-leading-zero`(01,02..)。2026-04-29 追加 |
| **用途別LP 8本** | `product-manga.html` / `recruit-manga.html` / `manga-ad-lp.html` / `company-manga.html` / `sales-manga.html` / `training-manga.html` / `inbound-manga.html` / `ir-manga.html` | `bm-i18n` + `bm-nav` + WP API | 2026-04-26 公開。SEO中核。**【旧】共通テンプレ `css/bm-lp-template.css`（`pm-*` クラス）— 7LPで現役**。**【新】v2 デザインシステム `css/bm-lp-v2.css` + `js/bm-lp-v2.js`（`lpv2-*` クラス）— 2026-05-13 `recruit-manga.html` でパイロット導入**。各LPは Hero→Manifest(KPI 3 strip)→Chapter 01 PROBLEM→Bridge→Chapter 02 STRENGTH→Chapter 03 FORMATS→Chapter 04 CASE STUDY(WP API動的)→Chapter 05 LIBRARY(ビズ書庫埋込)→Chapter 06 PRODUCTION FLOW(8 Step, HowTo Schema)→Chapter 07 FAQ(12問, FAQPage Schema)→NEXT ISSUE(関連LP7本)→TO BE CONTINUED(Ending) の構成。JSON-LD 5種: WebPage + Service + BreadcrumbList(2階層) + FAQPage、`@id` で相互参照、`inLanguage: ja-JP`、`datePublished/dateModified` を最新化、Service に `url` + `audience` + `offers(/contact)`。FAQ は共通6問+LP固有2問の計8問構成（v2 LPは12問）。1位獲得が目標で `tools/rank-tracker.py` でKW追跡中 |
| **漫画制作会社 比較ガイド** | `manga-production-company.html` | `bm-i18n` + `bm-nav` + `mpc.js` + `bm-fuwa` | 2026-04-27 公開、SEOブルーオーシャンKW「漫画制作会社」(月3,000-8,000検索)専用LP。専用CSS `css/mpc.css`。構成: Hero→Logoマーキー→PAIN(失敗の3パターン)→8選定基準→比較表(主要5社+ビズマンガ)→各社プロフィール→用途別マップ→数字で見る違い→FAQ(12問)→最終CTA。左sticky目次(1280px+)。JSON-LD 4種: Article + ItemList(6社) + BreadcrumbList + FAQPage。**2026-04-29 Xserver18項目に基づき可読性強化**: `mpc-mark`(マーカー強調)、`mpc-keyfacts`(業界数値の冒頭callout)、`mpc-pain-examples`(失敗パターン具体例リスト3行ずつ)、`mpc-summary`(比較表後の3行要約) を追加。**2026-05-12 SEO内部リンクハブ化**: 公開後ナビ登録のみで本文中リンクゼロ→Google重要度低判定→順位獲得未達という分析を踏まえ、pricing/faq/works/8用途LP の計11 HTML から `.bm-related-guide` aside で本文中アンカーテキスト付き内部リンクを集中投下。各LP固有のKW（採用マンガ対応の〜/IR漫画対応の〜 等）でアンカー多様化、ペナルティ回避と複合KW強化を両立。共通CSSは `css/bizmanga.css` 末尾。**ホーム(index.html)のバナー(`.bm-home-comparison-banner`)はCV重視で `/strength`（強み5選ページ）に流す方針** — 比較ガイド本体のコンテンツ完成度を訪問者向けに磨き上げるまで、検索流入経由でしか比較ガイドに到達しない設計にして他社情報経由のCV離脱を防ぐ |

## 1a. 用途別LP デザインシステム v2（2026-05-13）⭐進行中

8本の用途別LPは「Editorial Magazine」(pm-* / `bm-lp-template.css`) を共通テンプレとして 2026-04-26 に同時公開した。1位を狙うSEO中核ページであるため、ブランド体験・滞在時間・CV率を底上げする目的で、より大胆な「MANGA MAGAZINE × BRAND SITE」コンセプトの v2 デザインシステムに移行中。

### v2 の構成ファイル
| ファイル | 役割 |
|---|---|
| `css/bm-lp-v2.css` | 新デザインシステム（`lpv2-*` クラス、約760行） |
| `js/bm-lp-v2.js` | スクロールスパイ目次 + 折りたたみパネル + reveal-on-scroll |
| HTMLマーカー | `<!-- LP-DESIGN:v2 -->` を `<head>` 直後に置くと v2 判定される |
| `body` 属性 | `class="lpv2-page"` + `data-lp-v2` |

### v2 ビジュアル原則
- 黒（#0a0a0a） × クリーム（#fff8ed） × オレンジ（#e85500、ブランドアクセント） × イエロー（#ffd54a、ハイライト）の4色制
- 太枠（3pxソリッド黒）+ ドロップシャドウ（`8px 8px 0 黒`）の漫画コマ風カード
- ハーフトーンドット（`radial-gradient` SVG）、雑誌の刷り感
- Hero: 黒ベース全面写真 + マグ誌風メタ帯（VOL/ISSUE）+ ハーフトーンオーバーレイ + 写真フレーム
- 全章に章番号（CHAPTER 01..07）を導入し、雑誌のような章立てに

### v2 章立て
| 章 | セクション | クラス | id |
|---|---|---|---|
| Hero | カバー誌風 | `.lpv2-hero` | — |
| TOC | スティッキー章目次（スクロールスパイ） | `.lpv2-toc` | `#lpv2Toc` |
| Manifest | 宣言文 + KPI 3パネル | `.lpv2-manifest` | — |
| 01 | PROBLEM（3パネル、illust + 番号バッジ） | `.lpv2-problem` | `#chapter-01-problem` |
| Bridge | 全画面ブラック・宣言 | `.lpv2-bridge` | — |
| 02 | STRENGTH（4-koma風 2×2 + クリック展開） | `.lpv2-merit` | `#chapter-02-merit` |
| 03 | FORMATS（4カラム媒体カード） | `.lpv2-formats` | `#chapter-03-formats` |
| 04 | CASE STUDY（WP API、`tools/build-lp-cases.py` v2マークアップ対応） | `.lpv2-cases` | `#chapter-04-cases` |
| 05 | LIBRARY（ビズ書庫埋込、ブラックBG） | `.lpv2-library` | `#chapter-05-library` |
| 06 | PRODUCTION FLOW（8パネル、巨大番号アウトライン） | `.lpv2-flow` | `#chapter-06-flow` |
| 07 | FAQ（Q/Aセリフバッジ、`<details>`） | `.lpv2-faq` | `#chapter-07-faq` |
| Related | NEXT ISSUE（他7LPカード） | `.lpv2-related` | — |
| End | TO BE CONTINUED + CTA2本 | `.lpv2-end` | — |

### 移行ステータス
| LP | 移行状況 |
|---|---|
| `recruit-manga.html` | ✅ v2 移行済（2026-05-13、パイロット） |
| `product-manga.html` / `manga-ad-lp.html` / `company-manga.html` / `sales-manga.html` / `training-manga.html` / `inbound-manga.html` / `ir-manga.html` | ⏳ 旧 `pm-*` テンプレで稼働中、recruit 検証後に順次適用 |

### 旧テンプレとの並存
- 新旧2つの CSS / クラス体系は完全に独立しており、`pm-*` と `lpv2-*` は名前空間衝突なし
- 共通の`bm-i18n.js` / `bm-nav.js` / `bm-lp-library-embed.js` / `bm-sanitize.js` / `bm-kinsoku.js` はそのまま利用
- `tools/build-lp-cases.py` は HTML 内の `LP-DESIGN:v2` マーカーを検出して `pm-*` / `lpv2-*` のどちらでも出力できる
- 旧 `bm-lp-template.css` は v2 が全LPに展開完了するまで削除しない

## 2. URL パラメータ・特殊モード

### 2.0a コラムの2系統URL（制作事例と同パターン）

| URL系統 | 例 | 用途 | 即時性 | ターゲット |
|---|---|---|---|---|
| **`?id=xxx`** | `column-detail?id=483` | 動的取得（JS）。WP公開直後から動作 | ✅ 即時 | フォールバック・プレビュー |
| **`/column/{slug}`** | `/column/why-business-manga` | SEO向け静的ページ（JSON-LD付き） | ❌ 週1ビルド後（or 手動実行） | Google / AI検索 / SNSシェア |

- ホーム・一覧ページのカードリンクは `/column/{slug}` を使用
- ビルド: `tools/build-columns.py` + `.github/workflows/build-columns.yml`

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

### 2.0b 制作事例の用途別カテゴリページ（2026-04-28追加）⭐SEO

`/works/category/{slug}` で**用途別の事例集約ページ**を提供。legika型「showcase/category/」の戦略を踏襲し、用途別KWで個別URLとしてGoogleに認識させる。

| URL | ターゲットKW | 集約データカテゴリ |
|---|---|---|
| `/works/category/recruit` | 採用マンガ制作 | 採用 |
| `/works/category/product` | 商品紹介マンガ制作 | 商品紹介 + 紹介 |
| `/works/category/sales` | 営業マンガ制作 | 営業 |
| `/works/category/company` | 会社紹介マンガ制作 | ブランド + 紹介 |
| `/works/category/training` | 研修マンガ制作 | 研修 |
| `/works/category/ad` | マンガ広告制作 | 集客 + IP |
| `/works/category/ir` | IR漫画制作 | IR |

**動作メカニズム:**
- [tools/build-works.py](tools/build-works.py) の `CATEGORY_PAGES` 定義に基づき [tools/templates/works-category.html.tpl](tools/templates/works-category.html.tpl) から静的HTML生成
- 該当作品0件のカテゴリは生成スキップ（thin content 回避、sitemap にも含めない）
- 用途別LP（`/recruit-manga` 等）への内部リンクと、本ページ間の相互カテゴリナビを完備

**SEO構成（各ページ共通）:**
- title/H1 にKW完全一致を配置
- BreadcrumbList / CollectionPage / ItemList / FAQPage / Organization の5種JSON-LD
- 該当作品グリッド + カテゴリ解説200-300字 + FAQ 4問 + CTA 3ボタン
- canonical: `https://bizmanga.contentsx.jp/works/category/{slug}`

**`/works` のフィルターボタン:**
- `js/bm-works-page.js` の `buildFilter()` を改修。「すべて」以外のカテゴリボタンは `<a href="/works/category/{slug}">` リンクとして描画
- JS フィルター動作は廃止（同URL内での絞り込みはGoogleに別ページとして認識されないため）
- `CATEGORY_SLUG` マップで JA カテゴリ名 → slug 変換

**ビルド統合:**
- 個別作品ビルド (`generate_details`) と同じパイプラインで `generate_category_pages` を実行
- sitemap.xml に `BUILD:WORKS_CATEGORIES` ブロックで自動追記
- 週1ビルド（日曜03:00 JST、`.github/workflows/build-works.yml`）で更新

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
- **QR経由 vs 内部遷移の判別**: `document.referrer` が同一オリジンなら内部遷移（ホームギャラリー等）、そうでなければ QR 経由。後者は `<html class="qr-mode">` を付与
- **閉じるボタン (✕)**:
  - QR経由 (`qr-mode`): CSS `display:none` で非表示。JSクリック/ESCも無効 → 書庫に降りられない（元の仕様維持）
  - 内部遷移 (ホームギャラリー等): 表示。クリック/ESC で `biz-library`(パラメータなし) に遷移してライブラリを見せる
- **history.pushState**: ダイレクトモードでは呼ばない → ブラウザ戻る = 書庫ではなく前のページへ
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
| `js/bm-view-type.js` | 漫画ビュー縦読み/見開き判定 **一元管理** | `window.bmViewType.{isForcedVertical, isVerticalOnly, isVerticalByRatio, probeVerticalByImage}`。閾値・優先順を変えるときはこの1ファイルだけ触る |
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
| Google Ads | コンバージョン計測・リマケ | コンバージョンID `AW-18108125426`（GA4タグ直下に `gtag('config', 'AW-...')` 追加、2026-05-09 設置）。**CV計測イベント2種**: ①「お問合せフォーム到達」(`9tNKCNH49agcEPKh0LpD`) = `contact.html` head（onload内）で発火 / ②「送信完了サンクス」(`F13ECl3R3qgcEPKh0LpD`) = HubSpot送信成功 `.then()` 内で発火 |
| WordPress REST API | 漫画事例 / ニュース / テスティモニアル / コラム | `https://cms.contentsx.jp/wp-json/contentsx/v1` |
| LINE 公式 | LINEで相談 | `https://line.me/R/ti/p/@626kzaze?oat_content=url&ts=01071831` |
| GitHub Pages | ホスティング | `bizmanga.contentsx.jp` (CNAME) |

### WP API エンドポイント
- `/works?site=bizmanga` — 全漫画事例
- `/works-new?site=bizmanga` — 新作漫画（ホームギャラリー用）
- `/library` — ビズ書庫全作品
- `/news?site=bizmanga&per_page=50` — ニュース一覧
- `/columns?site=bizmanga&per_page=50` — コラム一覧
- `/columns/{id}` — コラム個別（本文含む）

### WP 編集可能フィールド
- `cx_title_en` / `cx_subtitle_ja` / `cx_subtitle_en`
- `cx_pages` / `cx_client` / `cx_point` / `cx_comment`
- `cx_sort_order` — 表示順（**数字が小さい＝先に表示**）
- `cx_show_gallery_bizmanga` — BizMangaギャラリー表示フラグ
- `cx_client_url` — ⭐ ビズ書庫最終ページCTA リンク先URL
- `cx_cta_label_ja` — ⭐ ビズ書庫最終ページCTAラベル（日本語、空欄＝デフォルト「公式サイトを見る →」）
- `cx_cta_label_en` — ⭐ ビズ書庫最終ページCTAラベル（英語、空欄＝デフォルト「Visit Official Site →」）
- `cx_cta_enabled` — ⭐ ビズ書庫最終ページCTA表示ON/OFFチェックボックス（**唯一の表示制御**）
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

### 6.1a ヘッダーCTA主従ルール（2026-05-13）
- **`.bm-nav-cta`（お問い合わせ）= プライマリ**: 塗り強調（`background: var(--bm-accent)` + 白文字）、padding `12px 26px`、font-size 15px、`min-height: 44px`
- **`.bm-nav-cta--line`（LINE相談）= セカンダリ**: 白背景+緑outline、padding `8px 16px`、font-size 13px、`min-height: 38px`
- モバイル(≤768px): `.bm-nav-cta--line` は `display: none`（追従CTA `.bm-fab` で代替）、`.bm-nav-cta` は常時可視（padding `10px 18px` に縮小）
- 過去の outline-only スタイルは廃止。プライマリCTAはサイト全体で塗り強調に統一

### 6.2 ドロップダウン仕様
- PC: hover で展開
- モバイル: 1回目タップで展開、2回目タップで遷移（親リンクあり）
- ドロップダウン展開中は他のドロップダウンを自動で閉じる

## 7. ホームページ特殊動作

### 7.1 追従CTA（`.bm-fab`）— 全ページ共通
- `js/bm-nav.js` が `contact.html` / `biz-library.html` 以外の全ページで自動注入（2026-04-24〜）
  - `biz-library.html` は漫画ビューアが全画面で開くとFABが被って読書体験を阻害するため除外（[js/bm-nav.js:268](js/bm-nav.js#L268)）
- **漫画ビューア表示中は全ページで非表示**: `body:has(.manga-modal.open) .bm-fab { display: none }` を [css/bizmanga.css](css/bizmanga.css) に定義。index/works等から漫画モーダルを開いた際も必ずFABが消える
- **2ボタン構成**: LINEで相談（`#06C755`）/ お問い合わせ（`var(--bm-accent)`）
- スクロール中も常時表示
- **デスクトップ**: 左下に固定幅ピルボタン（`--bm-fab-w: 200px; --bm-fab-h: 52px`）を横並び
  - **ホバー演出（旧sticky-cta流用）**: テキストが上にスライドアウト → 下から大きめアイコン（26px）がスライドイン（`cubic-bezier(0.16,1,0.3,1) / 0.5s`）
  - 同時に **ボタン上部にtooltip** が出現（`::before` + `::after` で三角付き、`data-tooltip` 属性参照）
- **モバイル (~768px)**: 画面下部に固定バー（flex:1 で左右2等分、白 + `backdrop-filter`）。スライド演出とtooltipは無効化、テキストのみ表示
- back-to-top ボタンはモバイル時 `bottom: calc(72px + safe-area-inset-bottom)` に退避
- フッターが隠れないよう **モバイルで `body { padding-bottom: 60px + safe-area-inset-bottom }`**
- i18n: `data-ja` / `data-en` 属性付きテキスト、注入後に `translateAll()` を呼ぶ

### 7.1.4 3Dスマホ端末 showcase（`#s3dSection`）⭐新規
- 位置: ホームギャラリー（`#newWorks`）の直前
- 役割: 「さまざまな媒体・形式で制作しています」— カラー漫画 / Webtoon / ボイスコミック の3媒体を3つのiPhone型端末で showcase
- タイル構成（左→右）:
  - カラー: `/embed-viewer?manga=ichinohe-home&slides=1&interval=4000`（4秒ごとに1ページずつフェード遷移）
  - Webtoon(中央・hero): `/embed-viewer?manga=omatome-ninja-new&speed=0.5`
  - ボイスコミック: YouTube 埋込 `yLwkUfi6KfQ`（autoplay+mute+loop+controls）
- iPhone UI 要素: 角丸44px + Dynamic Island(`.s3d-notch`) + ホームインジケータ(`.s3d-home-indicator`) + オレンジ光沢ベゼル
- ラベル位置: タイル直上(`bottom: 100% + 14px`)
- CTA: タイル直下に「詳しくはギャラリーで!」(`.s3d-cta` → `#newWorks`)
- スクロール演出（GSAP ScrollTrigger + pin）:
  - 初期: 中央1枚 scale 1.25（PC）/ 2.8（SP）で viewport 充填
  - scroll 進行で3分裂 → ラベル fade-in → 見出し表示
  - **単調増加のみ**: 最大到達 progress を保持、下→上スクロールで逆再生しない
  - `transform-origin: 50% 0%`（上端軸）でスマホ下端だけ伸縮、見出し衝突回避
- 依存: `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/{gsap,ScrollTrigger}.min.js`
- 実装: [css/bm-s3d-screens.css](BizManga/css/bm-s3d-screens.css) / [js/bm-s3d-screens.js](BizManga/js/bm-s3d-screens.js)
- CSP: `script-src` に `https://cdnjs.cloudflare.com` 必須
- **クリック遷移なし**: 3D showcase は「こういう媒体がある」と見せるだけ。個別作品へは下のギャラリーで

### 7.1.5 ホームギャラリーのタブフィルタ（`.bm-gallery-tabs`）
- `index.html` の `#newWorks` セクション内、ギャラリー見出し直下
- **3タブ**: 全て / Webtoon（縦読み） / 横読み
- 判定は `window.bmViewType.isForcedVertical(work)` に委譲（BUGS #013 の一元化ヘルパー）
  - Webtoon = `view_type in ['vertical_only','vertical']`
  - 横読み = それ以外
- タブ切替時は `bm-home.js` が `filterData()` → `buildGalleryCards()` で再描画、オートスクロールも再起動
- 該当作品0件時は `#bmGalleryEmpty` の「該当する作品がまだありません。」を表示
- i18n: `data-ja` / `data-en` 属性で英語切替対応

### 7.2 ヒーロー
- `.bm-hero` 背景: `#000 url(hp-material-1.webp) center/cover fixed`（ContentsXと共有）
- タグライン「マンガの力でビジネスを動かす」— 1文字ずつ波シャイン
- 漫画表紙カルーセル5行 + マウスパララックス（PC）

### 7.2b クライアントロゴ無限カルーセル（`.bm-client-logos`）⭐2026-05-13追加
- 位置: `.bm-hero` の直後、`.bm-about` の直前（2026-05-14に news の後ろから hero 直下へ移動）
- 役割: 取引/支援企業ロゴを横スクロールで自動再生し、信用補強。ContentsXトップと同じ構成・同じ社数（13社）
- データ: [js/data/bm-client-logos.js](js/data/bm-client-logos.js) の `BM_CLIENT_LOGOS` を編集すれば追加可
- 画像参照: ContentX側の `https://contentsx.jp/material/images/{clients,partners}/...` を絶対URLで参照（[[reference_bugs_md]] #020 同様、ContentX/material/ の画像を消すときは両サイトgrep必須）
- レンダリング: [js/bm-client-logos.js](js/bm-client-logos.js) が `BM_CLIENT_LOGOS` を6セット複製→`translateX(-16.6667%)` ループ
- CSS: [css/bizmanga.css](css/bizmanga.css) の `.bm-client-logos` セクション
- i18n: サブタイトル「大手企業からスタートアップまで幅広くご支援」に `data-ja` / `data-en` 設定済み

### 7.3 About セクション（`.bm-about`）レイアウト
- **PC（769px以上）**: 2カラムグリッド（`grid-template-columns: 1fr 1.1fr`、gap 72px）。左に heading「文章では届かない。マンガなら、届く。〜」、右に text 本文。`text-align: left`、heading下のアクセント線も左寄せ
- **SP（768px以下）**: 従来の縦積み中央寄せに戻す（`display: block; text-align: center`、アクセント線は `margin: auto`）
- 出典: 株式会社ファインズ e-tenki.co.jp のDX訴求セクション（2026-04-21 採用）
- CSS: [css/bizmanga.css:717-780](css/bizmanga.css)

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

### 9.1 最終ページCTA（クライアント送客） ⭐ 2026-04-22 追加
- **データソース**: WP CMS 漫画事例カスタムフィールド `cx_client_url` / `cx_cta_label_ja` / `cx_cta_label_en` / `cx_cta_enabled`
- **API公開キー**: `client_url`, `cta_label_ja`, `cta_label_en`, `cta_enabled`（`/library`, `/manga/{id}` 共通）
- **表示条件**: 以下を全部満たした時のみ表示
  1. `cta_enabled === true`（**WP管理画面のチェックボックスがON、これが唯一の表示トグル**）
  2. `client_url` が `http(s)://` で始まる有効URL（リンク不能を防ぐ最低限のチェック）
  3. 漫画ビューアで最終ページに到達（spread: 最終見開き / vertical: 末尾90%以上スクロール）
  4. 制作過程ページ（`_isPreProduction`）でない
- **ラベル**: 当該言語のラベルが空欄ならデフォルト文言にフォールバック（日本語=「公式サイトを見る →」、英語=「Visit Official Site →」）
- **言語切替**: `i18n-lang-changed` イベントを購読してラベルテキスト即時切替
- **アニメーション**: 最終ページ到達0.6秒後にフェードイン+下→上スライド
- **ホバーエフェクト**: ラベルテキストが上にスライドアウト → 「Let's go !!」（共通固定）が下からスライドイン（ホーム`bm-sticky-cta-btn`と同パターン）
- **カラー**: 背景 `var(--bm-accent)` (#EB5200) → ホバー `var(--bm-accent-hover)` (#C44400)、グロー演出付き
- **配置**: モーダル内 fixed、画面下部センター（PC見開き=bottom 96px、縦スクロール=bottom 28px、SP=bottom 20px）
- **リンク属性**: `target="_blank" rel="noopener"` のみ（nofollow/sponsoredは付けない＝編集リンクとしてSEOが両サイトに自然に流れる）
- **GA4イベント**: クリック時に `manga_cta_click` を送信、params: `{ manga_slug, client_url, language }`
- **モーダルを閉じる/別作品を開く時**: `hideMangaCta()` で確実にリセット
- **要素**: [biz-library.html#mangaCtaOverlay](biz-library.html) / JSロジック [js/works.js](js/works.js) / CSS [css/works.css](css/works.css) `.bm-manga-cta`
- **フラグ**: `isSpreadAnimating` でクリック入力をゲート

## 10. Service Worker

- [sw.js](sw.js) — Stale-While-Revalidate 戦略
- キャッシュ名: `bm-covers-v1`
- **キャッシュ対象**: `/material/manga/` / `/material/images/` / `/wp-content/uploads/`
- 初回: ネットワーク → キャッシュ保存、2回目以降: キャッシュから即返却

## 11. パフォーマンス最適化

- **Preload**: hero表紙6枚 (index), 3枚 (biz-library) を `<link rel="preload" as="image">`
- **works個別ページ**: ヒーロー画像を `<link rel="preload" as="image" fetchpriority="high">` + `<img fetchpriority="high" decoding="async">`。LCP候補を明示してクリティカルリクエストを先読み（2026-04-20導入）
- **works ヒーロー画像の解像度整合**（2026-04-21修正）: build-works.py で `gallery[0]`（フル解像度）を hero に使う。WPの `thumbnail` フィールドは 188x300 の自動生成サムネで、1200x630 として引き延ばすと画質劣化 + LCP要素として機能しないため避ける
- **ギャラリー画像**: `loading="lazy" decoding="async"` で非同期デコード（works 17ページ・2026-04-20導入）
- **dns-prefetch**: `cms.contentsx.jp`
- **preconnect**: フォント / WP API
- **Lazy load**: カルーセル複製分は `loading="lazy"`
- **CSS重複排除**: `/works/*.html` 17ページのインラインCSS（`.bm-work-detail-*` ブロック）を `bizmanga.css` へ集約（2026-04-20）。テンプレート `tools/templates/work-detail.html.tpl` も同期済み

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
| **SPA詳細シェル (news-detail/testimonial-detail/column-detail)** | **2026-04-20 `<meta name="robots" content="noindex, follow">` 付与済**。単一URLに全記事を集約するSPA構造のため、インデックス重複を排除。sitemap.xml からも `news-detail` / `testimonial-detail?id=451` の単数URLを削除 |
| works OG画像個別化 | **2026-04-20 対応済**。`tools/templates/work-detail.html.tpl` に `{{og_image}}` プレースホルダを導入し、`tools/build-works.py` が WP API の `thumbnail` を og:image に展開。17作品すべて個別画像化 |

### 2026-04-24 全ページ メタタグにパワーワード注入（第2弾）

SERP CTR最大化のため、SEO×マーケ観点でパワーワードを各ページに戦略配分。

**パワーワード配分戦略**:
| ページ | 注入ワード | 狙い |
|---|---|---|
| index | 【業界最安値級】+ 大手の約1/5 | 価格訴求 × CTR最大化 |
| pricing | 【業界最安値級】+ 大手の約1/5 | 購買直前の背中押し |
| strength | 業界最安値級を実現する5つの理由 | 差別化根拠の権威化 |
| works | 実績多数 + 業界屈指 | 社会的証明 |
| biz-library | 【全作品無料公開】+ 業界屈指 | 参入障壁の除去 |
| contact | 【初回30分無料】 | 心理的負担ゼロ化 |
| column | プロ直伝の攻略法 | 情報価値の権威化 |
| testimonials | 採用応募増・研修効果UPの実証事例 | 社会的証明の強化 |
| manga-types | 完全ガイド + 7ジャンル徹底解説 | 網羅性アピール |
| use-cases | 10シーン実例付き徹底解説 | 具体性で刺す |
| faq | 発注前の不安を全解消 | 不安解消 |
| news | 最新トレンド・常時発信 | フレッシュネス |

**景品表示法対策**:
- 「業界最安値級」「大手の約1/5」は **pricing.html 他社比較表** を実根拠として成立
- 「級」表現により相対表現化（断定回避）→ 優良誤認リスク低減
- 「最安値」（断定）は使用禁止

**変更箇所**: 12ページの `<title>` / `meta description` / `og:title/description` / `twitter:title/description` / WebPage schema の `name` / `description`（1ページあたり8箇所 × 12ページ = 96箇所）

**期待効果（Google再クロール後）**:
- SERP CTR 1.5〜2倍見込み（【】付き + 強訴求ワード）
- On-Page SEO +2点 / Search Visibility 時間差で +5点可能性
- ブランドメッセージ一貫性UP（すべて「業界最安値級」のビズマンガ）

### 2026-04-24 全ページ メタタグ最適化（SEO×マーケ視点）

Google検索結果のタイトル/サイト名/ディスクリプションがmetaと食い違う現象（`ビズマンガ | BizManga — ビジネス漫画制作サービス` / サイト名 `contentsx.jp` / body文を勝手に抽出したdescription）を解消するため、12ページ全ての meta + schema を一括再設計。

**設計原則**:
- **タイトル 26-33文字**（日本語SERP幅最適化）
- **ディスクリプション 84-101文字**（SP/PC両方で切れないサイズ）
- **各ページ独自のプライマリKW**を左詰め（カニバリゼーション防止）
- 末尾「｜ビズマンガ」統一でブランド浸透
- **具体価格（19,800円・1/5の価格）をmetaから全削除**（Google景品表示法リスク回避 + 柔軟性確保）
- **「ビズマンガ」カタカナ統一**（英字「BizManga」「ビズマンガ（BizManga）」は meta/schema から全除去）
- 実績数字（125項目・2週間・5つの理由・10選・7ジャンル）は信頼性シグナルとして残す

**ページ別プライマリKW**:
| ページ | 主KW | ファネル |
|---|---|---|
| index | ビジネス漫画制作 | Top |
| works | ビジネス漫画 制作事例 | Mid |
| biz-library | ビジネス漫画 サンプル | Mid-Low |
| pricing | ビジネス漫画 料金 | Low |
| faq | ビジネス漫画 よくある質問 | Low |
| contact | 無料相談 | Bottom |
| column | ビジネス漫画 活用 | Top |
| testimonials | ビジネス漫画 導入事例 | Mid |
| manga-types | ビジネス漫画 種類 | Top |
| use-cases | ビジネス漫画 活用場面 | Top-Mid |
| strength | 選ばれる理由 | Mid |
| news | 最新情報 | — |

**対応内容**:
1. 全12ページの `<title>` / `<meta description>` / `<meta og:title/og:description>` / `<meta twitter:title/twitter:description>` を再設計
2. [index.html](index.html) に **WebSite schema** 追加（`name: "ビズマンガ"`）→ Google検索結果のサイト名を `contentsx.jp` → `ビズマンガ` に変更する見込み
3. 全HTMLの `Organization.name: "ビズマンガ（BizManga）"` → `"ビズマンガ"` に統一
4. WebPage schema の name/description を新meta値に同期（pricing / testimonials / biz-library / contact / faq / news / strength / works）
5. faq.html 本文内の「BizManga」日本語表記をカタカナに統一

**反映待ち**: Google再クロール後、検索結果の表示が新titleに書き換わるまで1〜2週間。WebSite schema認識まで1〜4週間（Google側タイミング依存）。

### 2026-04-20 日本語禁則処理をサイト全体に適用

日本語は単語境界が無いため、長い見出し（例: 「マーケティング研究所」）がコンテナに収まらないと末尾1文字だけ次行に落ちる「孤立文字」問題が発生する。両サイトの CSS に禁則処理ルールを一括追加。

- [css/bizmanga.css](css/bizmanga.css) 末尾に追記（`h1-h4`, `.bm-*-title`, `.bm-*-heading` 等）
- [ContentX/css/style.css](../ContentX/css/style.css) 末尾に追記（`h1-h4`, `.hero-title`, `.section-title`, `.news-heading` 等）
- 適用ルール:
  - `text-wrap: pretty` — Chrome 117+/Safari 17.4+/Firefox 121+ が末尾孤立文字を自動回避
  - `line-break: strict` — Japanese 伝統的禁則（句読点などの行頭禁止）
  - `word-break: auto-phrase` — Chrome 119+ のフレーズ認識改行（対応ブラウザのみ progressive enhancement）

### 2026-04-20 コラム一覧ページ Hero テキストオーバーレイ化

ui-ux-pro-max + frontend-design の editorial パターンに基づき、H1・eyebrow・divider を hero 画像上にオーバーレイ表示に変更。

- hero-strip 高さ 360px → 420px に拡張（テキスト領域確保）
- `.bm-column-hero-overlay` を左下に絶対配置、bottom=56px / left=5vw
- 画像中央の女の子イラストを避けるため、`::before` で **105deg の方向性 scrim**（左下スポットライト型: 暖黒 `rgba(17,10,5,...)` で画像の暖色と馴染ませる）
- **text-shadow は不採用**（scrim方式が editorial 標準、AI slop 回避）
- モバイル: scrim を `to top` の縦方向に切替、hero h=340px、テキスト bottom=28px
- Masthead から H1/eyebrow/divider を撤去し、リード段落のみ残す（縦スペース節約）
- fetchpriority も `low` → `high` に変更（LCP要素としての役割明確化）

### 2026-04-20 コラム一覧ページ Editorial Magazine 化

ui-ux-pro-max の「Swiss Modernism 2.0」+「Newsletter/Content First」パターンに基づきコラム一覧 ([column.html](column.html)) を BtoBマーケティング専門誌の Web 版 風に刷新。

**構造変更**
1. Hero を h=1019px の全面イラスト → h=360px のシネマスコープ帯（`.bm-column-hero-strip`）に圧縮。LCPを H1 テキストへシフト。新画像 `hero-column.webp` (2400×1018) に差替（旧版は `hero-column.old.webp` にバックアップ）
2. Editorial Masthead セクション追加: `EYEBROW · ISSUE N` → Noto Serif JP 900 の H1 超大サイズ（clamp 40-88px）→ 赤アクセント線 → リード段落
3. カテゴリフィルター帯 (`.bm-column-filter` sticky、チップUI) 追加。WP API の `data.category` から動的生成
4. Featured 記事セクション追加（最新1件を 21:9 大判＋右本文のグリッドで表示）。JS で `<script id="bm-column-data">` の JSON から注入
5. カードを `data-category` 属性 + 読了時間メタ表示対応に拡張

**カテゴリ運用**
- WP側の `column_category` taxonomy は既に実装済み ([contentsx-cms.php:2479](../ContentX/wordpress/contentsx-cms/contentsx-cms.php#L2479))
- cms.contentsx.jp の管理画面で各記事にカテゴリを設定すると次回ビルドで反映
- カテゴリ色分け（CSS）: LP最適化=#e85500 / BtoB戦略=#1f1f1f / プロット・制作=#8b5cf6 / SNS・採用=#10b981 / 効果・科学=#0ea5e9 / ジャンル=#f59e0b
- 未設定記事は「その他」バケット扱い

**新規ファイル**
- [js/bm-column-filter.js](js/bm-column-filter.js): フィルタチップ生成 + Featured注入 + カードフィルタリング

**改修ファイル**
- [tools/build-columns.py](tools/build-columns.py): `estimate_readtime()` 追加、build_card に `data-category` + readtime 注入、update_column_html で Featured+カテゴリ一覧を JSON埋め込み、main実行順を detail→column.html→sitemap に変更
- [column.html](column.html): Editorial Hero / Masthead / Filter / Featured セクションを body冒頭に追加
- [css/bizmanga.css](css/bizmanga.css): 新クラス群（hero-strip / masthead / filter / featured / card meta）と Noto Serif JP 読み込み追加

### 2026-04-20 Performance緊急対応 + E-E-A-T改善（第4弾）

**課題**: seo-audit スキル(6エージェント並列)による再計測で総合66/100と判明。特に **Performance 35/100** が致命的で、LCP 19.8s / TBT 19.28s を記録。原因は HubSpot トラッキングスクリプト `js-na2.hs-scripts.com/48367061.js` がメインスレッドを約18秒占有していたこと（全25ページ共通）。また Content 58/100、Schema 72/100 で著者シグナル・dateModified一律問題が指摘された。

**修正**

1. **[js/bm-hubspot.js](js/bm-hubspot.js) 新設** — HubSpotトラッキングの遅延ローダー。初回ユーザーインタラクション (mousemove/scroll/touchstart/keydown/click) or 4秒後に動的 `<script>` 挿入。フォーム送信は `fetch` で `api.hsforms.com` を直叩きしているため遅延ロードの影響なし

2. **全25ページの `<script id="hs-script-loader">` を置換**: `<script src="/js/bm-hubspot.js" defer></script>` に統一。[tools/templates/column-detail.html.tpl](tools/templates/column-detail.html.tpl) も同時更新して再ビルド時の回帰を防止。LCP/TBT 大幅改善の見込み（19.8s → 3s 前後）

3. **[index.html](index.html) お客様の声セクション復元**: 2026-04-16 にコメントアウトされていた `bm-testimonials` セクションを復活。Experience/Trust シグナル +8pt 見込み

4. **[tools/build-columns.py](tools/build-columns.py) の dateModified ロジック強化**: WP 側 `post_modified` が全記事一律「今日」になっているケースを検出して、date_ymd にフォールバック。これで全15記事の dateModified が各 datePublished と一致する正常状態に戻る。QRG「コンテンツ鮮度偽装」ペナルティ回避

5. **コラム手動修正3ファイル再ビルドでの上書き防止**: `business-manga-production-guide.html` / `business-manga-production-guide-2.html` / `btob-manga-lp-lead-generation.html` は第3弾で title/description/FAQ Schema を手修正済み。再ビルドで上書きされたため `git restore` で復旧し、HubSpot置換のみ再適用。WP 側 excerpt_ja が正しく入るまでは、この3ファイルを build-columns.py で再生成してはいけない

**次の必須対応**
- WP admin で上記3記事の excerpt_ja / 本文を正しく更新（現状は他記事のコピーが混在）
- WP 側 post_modified を実際の更新日で記録する運用フロー確立

### 2026-04-20 ターゲットKW #1狙い + 日次ランク追跡（第3弾）

**課題**: GSC 実測で `ビジネスマンガ 制作` = 14位（`column/business-manga-production-guide-2`）。ただし同ページは **title・H1・本文が「漫画著作権」なのに description だけ「ビジネスマンガ制作ガイド」** という混線状態。姉妹ページ `-guide`（2なし）も **description が「X Twitter」のまま** でコンテンツと不整合。

**修正 (B-1〜B-4)**

1. **[column/business-manga-production-guide.html](column/business-manga-production-guide.html)** を「ビジネスマンガ 制作」#1狙いのフラッグシップに整合化:
   - title: `ビジネスマンガ制作の完全ガイド｜7ステップと費用相場【1P11,300円〜】`
   - description / og / twitter / JSON-LD headline を全て制作ガイド向けに書き換え
   - FAQPage JSON-LD（5問: 費用/納期/流れ/二次利用/BtoB vs BtoC）を追加

2. **[column/business-manga-production-guide-2.html](column/business-manga-production-guide-2.html)** を著作権コラムに整合化:
   - description / og / twitter / JSON-LD を漫画著作権・SNS引用ルール・二次創作ガイドライン向けに書き換え
   - 本文「AI時代だからこそ大切にしたい、クリエイターの『想い』」セクションが2回重複していたため削除

3. **[column/btob-manga-lp-lead-generation.html](column/btob-manga-lp-lead-generation.html)** を「BtoBマンガ」#1狙いに強化:
   - title: `BtoBマンガ制作｜無形商材のLP離脱率を改善しCVR向上させる完全ガイド`
   - description を「BtoBマンガ制作のプロが解説...」に刷新
   - H1・Breadcrumb・OGP・Twitter・Article JSON-LD 全同期
   - FAQPage JSON-LD（5問: BtoBマンガとは/CVR効果/費用/対象業界/流れ）追加

4. **[index.html](index.html) bm-whatis セクション**: 「ビジネスマンガ制作サービス」「BtoBマンガ制作」にターゲットコラムへのキーワード内部リンクを追加。CSS `.bm-whatis-link` を [css/bizmanga.css](css/bizmanga.css) 末尾に新設

   **2026-05-14 拡張**: bm-whatis に8つの用途別LPへの導線カードを追加（`.bm-whatis-uses` / `.bm-whatis-use-card` クラス）。リード文を `.bm-whatis-lead` として9用途を網羅、続けて4×2グリッド（SPは1列）でLP一覧を提示。各カードは num / title / desc / arrow の3列2行 grid で、`<a>` 要素全体がクリッカブル。導線先: /product-manga, /recruit-manga, /sales-manga, /training-manga, /company-manga, /manga-ad-lp, /inbound-manga, /ir-manga

**日次ランク追跡 (A)**

5. **[tools/rank-tracker.py](tools/rank-tracker.py) 新設**: GSC Search Analytics REST API を直接叩き、12ターゲットキーワードの position / clicks / impressions / CTR を `tools/rank-history.jsonl` に1行追記（BizManga + ContentsX 両サイト）。依存: `urllib` のみ、google-api-python-client 不要

6. **[.github/workflows/rank-tracker.yml](.github/workflows/rank-tracker.yml) 新設**: 毎日 00:00 UTC (JST 09:00) に `rank-tracker.py` を実行 → `rank-history.jsonl` を自動コミット。Secrets 必須: `GSC_CLIENT_ID` / `GSC_CLIENT_SECRET` / `GSC_REFRESH_TOKEN`（OAuth リフレッシュトークン）

**初回データ (2026-04-11〜2026-04-18 window)**
- BizManga: データウィンドウ短すぎ、12ターゲットすべて no data
- ContentsX: `ビズマンガ` pos=8 (1 click), `contentsx` pos=1 (3 clicks)

### 2026-04-20 SEO採点反映改善 第2弾（86→92→95+目標）

- **`tools/build-works.py` / `tools/build-columns.py` の regex バグ修正**: マーカー `<!-- BUILD:WORKS (auto-generated by tools/build-works.py) -->` のコメント内追加テキストに対応できず、再実行のたびに sitemap.xml 末尾にブロックが累積していた。`<!-- BUILD:XXX[^>]*?-->` に変更して冪等化。既存の重複ブロックは再ビルドで解消
- **[tools/build-works-og.py](tools/build-works-og.py) 新設**: 作品個別の 1200×630 専用OG画像を Pillow で生成。左にWPサムネ、右にタイトル・カテゴリ・ブランド帯を合成。`material/images/og/works/{slug}.webp` に出力
- `build-works.py` の og_image 割当を変更: `material/images/og/works/{slug}.webp` 存在時はそれを採用、無ければ WP thumb にフォールバック
- テンプレに `og:image:width=1200` / `og:image:height=630` を復元 → summary_large_image カードが正しい寸法でレンダリング
- **画像 width/height 属性を77件追加**（CLS対策）: ヘッダーロゴ・フッターロゴ・flow 8枚・strength比較・pricing-hero・manga-types character など主要画像
- alt属性欠落: 0件を確認（空alt 72件はすべて `role="presentation"` 装飾画像 / JS動的代入 / WPコラム本文で問題なし）

### 2026-04-20 SEO採点反映改善（監査スコア 86/100 → 目標 90+）

- `news-detail.html` / `testimonial-detail.html` / `column/index.html` に `<meta name="robots" content="noindex, follow">` を追加（`column-detail.html` は既に付与済）。SPA詳細シェルが重複メタで1URL扱いされる問題を回避
- `sitemap.xml` から `news-detail` 単数URL・`testimonial-detail?id=451` 単数URLを削除（静的化するまでサイトマップに載せない方針）
- [tools/templates/work-detail.html.tpl](tools/templates/work-detail.html.tpl) の `og:image` / `twitter:image` を `{{og_image}}` プレースホルダに変更し、[tools/build-works.py](tools/build-works.py) が WP の `thumbnail` を注入するように改修 → 17作品すべて個別 og 画像化

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
- **コラム個別ページ Article JSON-LD 拡張**（2026-04-20）: `/column/*.html` 15ページに `wordCount`（本文文字数）/ `inLanguage: "ja"` / `articleSection`（カテゴリ）を追加。AI検索エンジンへの記事規模・言語・カテゴリシグナル強化
- **column BreadcrumbList position 3 に `item` URL 追加**（2026-04-21）: 15コラムページ全件で最終ノードがリンクとして機能するよう修正。テンプレート `tools/templates/column-detail.html.tpl` も同期
- **works CreativeWork schema の `image` を `ImageObject` 形式化**（2026-04-21）: `{@type: ImageObject, url, width: 1200, height: 630}` で 1200x630 OG画像を参照。Google Discover のサムネイル候補化に寄与
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
4. **QRダイレクトモードでの閉じるボタン** → §2.1 参照。閉じる/ESCは `biz-library` 遷移、history.pushState は呼ばない
5. **表示順の重複** → `cx_sort_order` が同数字だと投稿日順になって不安定 → §5 の運用ルール参照
6. **CTAセクション変更** → [js/bm-cta.js](js/bm-cta.js) 1箇所を編集すれば全ページ反映
7. **⭐ サブディレクトリからのリンクは必ず絶対パス（/始まり）を使う** → `column/{slug}.html` や `works/{slug}.html` のサブディレクトリ内ページで `href="contact"` のような相対パスを使うと `/column/contact` に解決されて404になる。HTML・JS・テンプレート問わず、全リンクは `href="/contact"` のように `/` 始まりにする。2026-04-17に bm-nav.js / bm-cta.js / bm-pricing-quiz.js / bm-testimonials-page.js / 両テンプレートで発生・修正済み
8. **⭐ 住所は「東京都目黒区中目黒1-8-8 目黒F2ビル1F」に統一 / 郵便番号は `153-0061`** → 旧住所「目黒2-11-15 8階」を 2026-04-21 に統一。同日に郵便番号も `153-0042 / 153-0051 / 153-0063` の3系統混在を `153-0061`（中目黒1丁目の正式番号）に統一。新規ページ追加時は必ず新住所 + i18n data-ja/data-en ペア + 正しい郵便番号を記述。NAP一貫性 (Name/Address/Phone) は Trust / Local SEO 直結
9. **⭐ works ヒーロー画像は `gallery[0]` を使う（`thumbnail` フィールドは使わない）** → WP API の `thumbnail` は 188x300 の自動生成サムネが返ることがあり、1200x630 として引き延ばすと画質劣化 + LCP要素として Lighthouse に認識されない。2026-04-21 に build-works.py を `gallery[0]` 優先に修正
10. **⭐ 空のお客様コメントは「—」ではなくセクション自体を非表示に** → WP側に `comment` が未入力の場合は `<section>お客様コメント</section>` 全体をレンダリングしない。空欄ダミーは SEO (Helpful Content / E-E-A-T) 減点要因。2026-04-21 build-works.py で条件分岐化
11. **⭐ メガメニューはモバイルで `position: static` に上書き必須** → `.bm-nav-megamenu` はデスクトップで `position: absolute` + `:hover/:focus-within` 展開。モバイルドロワー（`.bm-nav.open`）では絶対配置のままだと他ナビ項目（料金/コラム/FAQ）に被さってスクロールできない。`@media (max-width: 880px)` 内で `.bm-nav.open .bm-nav-megamenu` を `position: static; display: none;`、`.is-open` 時に `display: block` で展開し、`:hover/:focus-within` 由来のフロート展開を打ち消すこと。2026-04-26 修正
12. **⭐ LP CASE STUDY は静的詳細を持つ作品だけに絞る** → `tools/build-lp-cases.py` が `/works/{slug}` リンクで CASE STUDY カードを生成するが、`build-works.py` は `show_site=="both"` の作品しか静的詳細ページを作らない。それ以外（`shohin-shokai` / `merumaga` 等）を CASE STUDY に出すと、404→`404.html` 内の自動リダイレクトで `/biz-library?manga={slug}` (漫画ビューア) に飛ばされる。`build-lp-cases.py` の `filter_for_lp` で `has_static_detail()` を必ず通すこと。2026-04-27 修正
13. **⭐ CSS Grid 親要素の子に新タグを追加する時は必ず `grid-area` を指定** → `manga-production-company.html` の `.mpc-pain-entry` は `grid-template-areas: "num quote" / "num body"` の2カラム3行Grid。子に `<ul>` を追加した際、`grid-area` 未指定で auto-placement により細い `num` 列(96px)に配置されてレンダリング崩壊した。Grid親に追加する子要素は (1) `grid-template-areas` を拡張 (2) 子に `grid-area: <name>` を必ず付与の2点セット。2026-04-29 修正
14. **⭐ `<ul>` の直接の子に `<p>` を置かない** → 同じく 2026-04-29 mpc改善時、`<ul>` 直下に `<p class="mpc-pain-examples-title">` を置いて HTML仕様違反 + ブラウザの暗黙閉じタグでレイアウト崩れ。リスト見出しは `<ul>` の外側 `<div>` でラップして `<span>` か `<p>` で配置すること
15. **⭐ `transform: scale` はレイアウトボックスに反映されない** → `index.html` のトップ3D showcase (`#s3dSection`) で、JS が `gsap.set(wrap, {scale: 2.8})` で中央スマホを拡大していたが、`min-height: 100vh` の stage 内で `align-items: center` が **元のboxサイズ(208px)** を中央配置するため、スマホ実機で **News末尾→巨大白空白(約400px)→拡大スマホの一部→白空白→ギャラリー** という崩れた表示になっていた。修正: スマホ用に `.s3d-stage { min-height: auto; padding: 80px 0 60px; }` で stage を最終状態(scale 1)コンテンツに合わせる。初期 scale 2.8 のはみ出し分は `overflow: hidden` で見切れて自然な演出になる。2026-04-29 修正
15. **⭐ LP の SP アコーディオンで開く要素は `grid-column: 1 / -1` 必須** → `bm-lp-template.css` の `.pm-pain-item` / `.pm-merit-item` は `grid-template-columns: auto 1fr` の2列Grid（番号列 + 本文列）。`.is-open` で出てくる `.pm-*-detail` に `grid-column` 指定がないと auto-placement で「番号」列(auto=狭い)に押し込まれ、本文が1文字ずつ縦書き状に折り返される。`.pm-format-detail` と同じく `grid-column: 1 / -1` を必ず付ける。Gotcha #13 と同じパターン（Grid親 + 子の暗黙配置）。2026-04-29 修正、BUGS.md #019

## 15.1 セキュリティ・既知のリスク

WP管理者が信頼前提で運用しているが、将来的に侵害された場合に持続的XSSが成立する経路が以下に存在する。優先度順に対応予定。

| # | 場所 | リスク | 対応方針 |
|---|------|--------|---------|
| S1 | [tools/build-columns.py](tools/build-columns.py) `build_detail_page` の `{{content_html}}` | WP本文をエスケープなしでテンプレ流入 → script注入で全コラムページXSS | `bleach` 等でallowlistサニタイズ（GitHub Actions に `pip install bleach` 追加必要） |
| S2 | [tools/templates/column-detail.html.tpl](tools/templates/column-detail.html.tpl):80-87 / [work-detail.html.tpl](tools/templates/work-detail.html.tpl):60-86 | `{{title_ja}}` 等が `html.escape(quote=True)` 経由でJSON-LD内に挿入。`\` や `\n` が含まれるとJSON構文破壊リスク | JSON-LD自体を build側で `json.dumps` してテンプレに `{{json_ld}}` で1ブロック差し込む設計に変更 |
| S3 | [js/bm-wp-api.js](js/bm-wp-api.js):167-174 `loadColumns()` | WP由来の `title_ja / category / thumbnail` を未エスケープで `innerHTML` 連結 | 既存 `window.bmSanitize.html()` を使う |
| S4 | 全HTMLヘッダー | CSP / HSTS / Permissions-Policy ヘッダなし（GitHub Pages制約） | `<meta http-equiv="Content-Security-Policy">` で許容範囲のCSPを meta タグで追加 |

### 既に対応済み（2026-04-21）

- [tools/build-works-og.py](tools/build-works-og.py) `load_thumb`: SSRF対策。`THUMB_ALLOWED_HOSTS = {cms.contentsx.jp, contentsx.jp, bizmanga.contentsx.jp}` + scheme=https のみ許可
- [tools/rank-tracker.py](tools/rank-tracker.py) `get_access_token`: client_id等のlength出力を `DEBUG_OAUTH` 環境変数指定時のみに制限

### Pythonツール変更ログ（2026-04-21）

- **build-columns.py**: WP API fetch を `ThreadPoolExecutor(max_workers=5)` で並列化。約20秒→6-10秒に短縮。`_fetch_detail_safe` でエラーは個別 stderr 出力に統一
- 定数定義位置と `from datetime import date` をモジュール先頭に整理

## 16. 回帰テスト

### 16.1 モバイルヘッダー（ハンバーガー）回帰テスト

[tools/test_mobile_nav.py](tools/test_mobile_nav.py) — Playwright でハンバーガーの表示/クリック可/開閉/ESC/scroll lock を6ページ分検証。

**実行**（cwd は BizManga/ 直下）:
```bash
python3 ~/.claude/skills/webapp-testing/scripts/with_server.py \
    --server "python3 serve.py" --port 8000 \
    -- python3 tools/test_mobile_nav.py
```

**いつ走らせるか**:
- ヘッダー・ナビのHTMLやCSSを変更したとき
- [js/bm-nav.js](js/bm-nav.js) を変更したとき
- 新ページ追加時（`TARGET_PAGES` に追加してから）

過去に「ハンバーガー押せない」問題が複数回再発したため必須チェック化。
