# BizManga 仕様書

**ドメイン**: bizmanga.contentsx.jp
**リポジトリ**: [josawa2255/bizmanga](https://github.com/josawa2255/bizmanga)
**デプロイ**: GitHub Pages（CNAME: お名前.com）
**最終更新**: 2026-04-20

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
| コラム詳細(静的SEO) | `column/{slug}.html` | GitHub Actions | `tools/build-columns.py` で自動生成。Article JSON-LD・OGP・GA4完備。週1 + 手動実行 |

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
8. **⭐ 住所は「東京都目黒区中目黒1-8-8 目黒F2ビル1F」に統一** → 旧住所「目黒2-11-15 8階」が works個別テンプレート / testimonial-detail.html に残存していたのを 2026-04-21 に統一。新規ページ追加時は必ず新住所 + i18n data-ja/data-en ペアを記述。NAP一貫性 (Name/Address/Phone) は Trust / Local SEO 直結
9. **⭐ works ヒーロー画像は `gallery[0]` を使う（`thumbnail` フィールドは使わない）** → WP API の `thumbnail` は 188x300 の自動生成サムネが返ることがあり、1200x630 として引き延ばすと画質劣化 + LCP要素として Lighthouse に認識されない。2026-04-21 に build-works.py を `gallery[0]` 優先に修正
10. **⭐ 空のお客様コメントは「—」ではなくセクション自体を非表示に** → WP側に `comment` が未入力の場合は `<section>お客様コメント</section>` 全体をレンダリングしない。空欄ダミーは SEO (Helpful Content / E-E-A-T) 減点要因。2026-04-21 build-works.py で条件分岐化

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
