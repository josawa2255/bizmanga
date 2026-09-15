# 漫画表示・WordPress接続を触ったPRの確認手順（pr-gate 重要領域）

> **2026-09-15 平澤指示**: 「ビズ漫画の漫画の表示や WordPress との接続などは、絶対にバグらないようにしてほしい。
> そのあたりを触った場合は、そこが壊れていないかなどをレビューするようにしてください。」
>
> この文書は、その指示を機械的に守るための**確認手順の正本**です。
> トリガーは [.claude/pr-gate-paths.txt](../.claude/pr-gate-paths.txt)（触ると PR が HIGH になり `gh pr merge` が止まる）。
> ゲートの仕組み自体は `~/.claude/hooks/pr-review-gate.sh`（全プロジェクト共通）。

## 0. 対象（このどれかを触ったら本手順が必須）

| 領域 | ファイル | 壊れると何が起きるか |
|---|---|---|
| ビズ書庫ビューア | `biz-library.html` / `js/works.js` / `js/bm-view-type.js` / `js/bm-viewer.js` / `css/works.css` | **QRコードで外部配布済み**の `/biz-library?manga=id` が開かない・ページ送りできない（BUGS #010/#012/#013） |
| ホーム | `index.html` / `js/bm-hero.js` / `js/bm-home.js` / `js/bm-pre-production.js` | Hero マーキー・ギャラリー（横読み/縦読み）が空になる（#051/#052） |
| 制作事例 | `works.html` / `js/bm-works-page.js` / `js/bm-works.js` / `js/bm-work-modal.js` / `js/bm-wd-split.js` | 一覧・モーダルが出ない。**index と works は同じDOMで別JS**なので両方見る |
| 埋込・LP | `embed-viewer.html` / `js/bm-lp-library-embed.js` | ホームの3D画面・用途別LPの書庫埋込が真っ黒 |
| WP 接続 | `js/bm-wp-api.js` / `js/bm-wp-config.js` / `js/bm-sanitize.js` | 全ページの WP 由来データが消える／XSS（#009/#039） |
| WP 由来データを描くページ | `artists.html` `js/artists*.js` / `testimonials*.html` `js/bm-testimonials*.js` / `column*.html` `news*.html` `js/bm-column-filter.js` / `js/bizanime.js` | 該当ページが空になる |
| 静的ビルド | `tools/build-*.py` / `tools/templates/` / `.github/workflows/build-*.yml` | `/works/{slug}` `/column/{slug}` が消える・古い文言で上書き（#021/#048） |
| Service Worker | `sw.js` | 表紙画像が古いまま／読めない |

WPプラグイン本体（PHP）は**別リポジトリ**（`~/Documents/contentX/web/contentsx-wp-plugin/`、PRIVATE）。
そちらを触った場合も、このリポジトリ側の確認（§1〜§3）を本番APIに対して実行する。

## 1. 自動スモークテスト（必須・最初にやる）

```bash
# 作業ブランチの worktree で
python3 -m http.server 8127 --bind 127.0.0.1 &          # ローカル配信
python3 tools/smoke-manga-wp.py --base http://127.0.0.1:8127
```

確認していること（全部 PASS が条件）:

1. **WP API の生レスポンス**: `/works?site=bizmanga` `/works-new?site=bizmanga` `/library` `/news` `/columns` が件数>0、
   各作品に `id / gallery / view_type / thumbnail` があり、`/manga/{id}` の枚数が `/library` と一致、gallery 画像URLが到達可能
2. **ホーム**: Hero マーキーに表紙が並ぶ、ギャラリーのカード数が `/works-new` の件数と一致、カードのリンクが `biz-library?manga=`
3. **制作事例**: カードが出る → クリックでモーダル `#workDetailOverlay` が開き、漫画画像が実際に読み込まれる
4. **ビズ書庫**: グリッドが出る → クリックで `#mangaModal` が開き画像が読み込まれる → 閉じられる
5. **QRモード**: referrer なしで `?manga=id` を開くと `html.qr-mode` が付く／サイト内遷移（referrer あり）なら付かない（#010）
6. **埋込ビューア**: `embed-viewer.html?manga=id&manual=1` で画像が出る
7. **スマホ**（390px）: `?manga=id` で `#mobileView` に画像が出る
8. **どのページでも** JS の未捕捉エラー・自サイト起因の console error・自サイトへの 404 が無い

失敗したら原因を直してから再実行。**テストの側を緩めて通さない**（緩めるときは平澤さんに理由を説明してOKをもらう）。
マージ後は本番にも同じテストを当てる: `python3 tools/smoke-manga-wp.py --base https://bizmanga.contentsx.jp`

## 2. 目視（自動テストが見ない部分）

- ビューア（PC）: 見開き→矢印/クリックでページ送り、`viewToggle` で縦読みへ切替、**最終ページCTA**（`cta_enabled` の作品で表示、他では出ない）
- ビューア（SP）: 縦読み、上下2ペイン分割（`bm-wd-split.js`）、タップ左右でページ送り
- 縦読み作品（`view_type: vertical` / `vertical_only`）と見開き作品を**1つずつ**開く。判定は `window.bmViewType.*` に委譲されているか（自前判定を足していないか、#012/#013）
- ホーム: 横読み/縦読みの2グループに分かれている、新作の並び順が WP の「表示順」どおり（`cx_sort_order` 昇順）
- `/works/{slug}`（静的ページ）と `/works` 一覧のカテゴリフィルタ
- EN 切替でビューアのUI文言が壊れない（読込順 i18n → nav、`translateAll` 無条件呼び禁止、#005/#008）
- CSP メタを触った場合: `connect-src` / `img-src` に `https:`（cms.contentsx.jp）が残っている

## 3. WP 接続を触った場合の追加確認

- 生レスポンスを curl で数える（管理画面の設定を疑う前にまず API、#051）:
  `curl -s "https://cms.contentsx.jp/wp-json/contentsx/v1/works-new?site=bizmanga" | jq 'length'`
- **`/library` と `/manga/{id}` の両分岐**で同じ作品を確認（#012）。新フィールドは両エンドポイントに通す（#001）
- WP 出力を `innerHTML` に入れる箇所は `bmSanitize` 経由か（#039、`js/bm-sanitize.js`）
- 掲載先フラグは「未設定＝表示する」（SPEC §5 表示先・順序制御）。判定を `=== '1'` に戻していないか
- **フォールバック**: DevTools で `cms.contentsx.jp` をブロック（または `bm-wp-config.js` の `enabled:false`）してホーム・制作事例がローカルデータで表示され、真っ白にならない
- PHP を直した場合: `php -l` → お名前.com 手動アップロード（#002）→ nginx キャッシュ最大10分を待ってから生URLで新値を確認（#048）

## 4. 静的ビルドを触った場合

- ローカルでビルドを回して生成物の差分を見る: `python3 tools/build-works.py && git diff --stat works/ works.html sitemap.xml`
  （意図しない大量削除・全件書き換えが無いか。テンプレ `tools/templates/` と生成HTMLを同時に直す、#021）
- ビルド直後は WP 側の nginx キャッシュで旧文言が入ることがある（#048）。生成物を grep して新値を確認するまでが1セット

## 5. 完了条件とマージ

1. §1 の自動テストが全 PASS（結果の PASS/FAIL 一覧をそのまま報告に貼る）
2. §2〜§4 のうち該当する項目を目視し、結果を報告に書く
3. `/code-review high` と `/security-review` の指摘に対応済み
4. 変更ファイル一覧・PRのURL・上記の結果を平澤さんに提示して **OKをもらう**
5. `bash ~/.claude/hooks/pr-review-gate.sh --approve human` を記録 → `gh pr merge`
   （**この領域では `--approve ai-clean` は使わない**。ゲート側でも ai-clean の記録は拒否される）
6. マージ後: 本番に §1 のテストを当てる → ブランチ削除

## 関連

- 過去バグ: [../../BUGS.md](../../BUGS.md) #001 #002 #004 #005 #008 #009 #010 #012 #013 #021 #039 #046 #047 #048 #049 #050 #051 #052
- 仕様: [../SPEC.md](../SPEC.md) §2.0b（embed-viewer）/ §5（WP API・フラグ）/ §8（事例モーダル）/ §9（ビューア）/ §10（SW）/ works 再ビルドルール
- Git 運用: [../github.md](../github.md) §4
