#!/usr/bin/env python3
"""
smoke-manga-wp.py — BizManga「漫画の表示」と「WordPress接続」のスモークテスト

目的（2026-09-15 平澤指示）: 漫画ビューア / ホームギャラリー / 制作事例モーダル / 埋込ビューア と
WP API 接続が「壊れていないか」を、人の目に頼らず機械的に確認する。
対応するチェックリスト: docs/REVIEW-MANGA-WP.md §1

使い方:
  python3 tools/smoke-manga-wp.py --serve .                              # 推奨: 内蔵サーバー(127.0.0.1:5500)で配信して検証
  python3 tools/smoke-manga-wp.py --base https://bizmanga.contentsx.jp  # 本番にも当てられる（マージ後の確認）
  python3 tools/smoke-manga-wp.py --api-only                             # WP API だけ（ブラウザを使わない）

ローカル検証の仕組み:
  - 内蔵サーバーはリポジトリ直下 serve.py の CleanURLHandler（拡張子なしURL対応）を再利用し、127.0.0.1 だけで
    待ち受ける。ディレクトリ一覧は GitHub Pages と同じく 404。`python -m http.server` は `biz-library?manga=` への
    サイト内遷移が 404 になるので使わない
  - WP プラグインの CORS 許可オリジンは 本番 + http://127.0.0.1:5500 + http://localhost:3000（contentsx-cms.php）。
    既定ポート 5500 なら**実際の CORS 設定のまま**通る。別ポートを指定したときだけ、Playwright で API 応答を中継して
    Access-Control-Allow-Origin を足す（その場合 CORS 設定そのものは検証されない）
  - http 配信では CSP frame-src（https: のみ）で 127.0.0.1 の埋込 iframe が拒否されるログが出る。そのローカル起因分だけ無視する
  - --api は Python 側の API 確認にだけ効く。ブラウザ側は常にサイト自身の js/bm-wp-config.js の URL を使う
  - QR直リンク・埋込・スマホの確認には、works.js のローカルフォールバック表（FALLBACK_WORKS）に**無い**作品を選ぶ
    （フォールバックにある作品は WP が壊れていても開けてしまい、WP 接続の確認にならない）

終了コード: 全 PASS で 0、1つでも FAIL なら 1（例外で中断した区画も FAIL として集計）。
必要なもの: Python 3.9+、playwright（pip install playwright && python3 -m playwright install chromium）
"""
import argparse
import json
import os
import re
import sys
import threading
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

DEFAULT_API = "https://cms.contentsx.jp/wp-json/contentsx/v1"
DEFAULT_PORT = 5500
# WP プラグイン（contentsx-cms.php cxcms_allowed_origins）が許可しているローカルオリジン
CORS_ALLOWED_LOCAL_ORIGINS = {"http://127.0.0.1:5500", "http://localhost:3000"}
# エラー・404 を「自分の責任範囲」として数えるホスト（サイト自身 + WP + 素材置き場）
WATCH_HOST_SUFFIXES = ("contentsx.jp",)
RESULTS = []  # (name, ok, detail)


def rec(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS  " if ok else "FAIL  ") + name + ("  — " + detail if detail else ""), flush=True)


def get_json(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": "bm-smoke/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def get_text(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": "bm-smoke/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def url_ok(url, timeout=15):
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers={"User-Agent": "bm-smoke/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return 200 <= r.status < 400
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405):
                continue
            return False
        except Exception:
            return False
    return False


def img_url(entry):
    """gallery の要素は文字列URL か {url|src|full} の dict のどちらでも受ける"""
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict):
        for k in ("url", "src", "full", "large"):
            if entry.get(k):
                return entry[k]
    return ""


# ------------------------------------------------------- Built-in server
def make_handler(directory):
    """リポジトリ直下の serve.py（クリーンURL）を再利用。無ければ同等の最小実装で代替"""
    base_cls = SimpleHTTPRequestHandler
    if os.path.isfile(os.path.join(directory, "serve.py")):
        try:
            sys.path.insert(0, directory)
            import serve  # noqa: E402  (BizManga/serve.py)
            base_cls = serve.CleanURLHandler
        except Exception:
            base_cls = SimpleHTTPRequestHandler
        finally:
            if sys.path and sys.path[0] == directory:
                sys.path.pop(0)

    class Handler(base_cls):
        def translate_path(self, path):
            full = super().translate_path(path)
            # serve.py が無いときの保険: /foo → foo.html（ディレクトリより .html を優先）
            if not os.path.exists(full) and not os.path.splitext(full)[1] and os.path.isfile(full + ".html"):
                return full + ".html"
            return full

        def list_directory(self, path):
            # GitHub Pages はディレクトリ一覧を出さない（index.html が無ければ 404）
            self.send_error(404, "Not Found")
            return None

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def log_message(self, *a):
            pass

    return Handler


def start_server(directory, port):
    handler = partial(make_handler(directory), directory=directory)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


# ---------------------------------------------------------------- API
def check_api(api):
    data = {"works": [], "works_new": [], "library": [], "manga_one": None}
    try:
        works = get_json(f"{api}/works?site=bizmanga")
        data["works"] = works if isinstance(works, list) else []
        rec("API /works?site=bizmanga 件数>0", len(data["works"]) > 0, f"{len(data['works'])}件")
        bad = [w.get("id") for w in data["works"]
               if not (w.get("id") and isinstance(w.get("gallery"), list) and w["gallery"]
                       and w.get("view_type") and w.get("thumbnail"))]
        rec("API /works 各作品に id/gallery/view_type/thumbnail", not bad, f"欠落: {bad[:5]}" if bad else "")
        vts = sorted({str(w.get("view_type")) for w in data["works"]})
        rec("API /works view_type が既知の値", set(vts) <= {"spread", "vertical", "vertical_only"}, ", ".join(vts))
    except Exception as e:
        rec("API /works?site=bizmanga", False, str(e)[:140])

    try:
        new = get_json(f"{api}/works-new?site=bizmanga")
        data["works_new"] = new if isinstance(new, list) else []
        rec("API /works-new?site=bizmanga 件数>0", len(data["works_new"]) > 0, f"{len(data['works_new'])}件")
    except Exception as e:
        rec("API /works-new?site=bizmanga", False, str(e)[:140])

    try:
        lib = get_json(f"{api}/library")
        data["library"] = lib if isinstance(lib, list) else []
        rec("API /library 件数>0", len(data["library"]) > 0, f"{len(data['library'])}件")
        bad = [w.get("id") for w in data["library"]
               if not (w.get("id") and isinstance(w.get("gallery"), list) and w["gallery"])]
        rec("API /library 各作品に gallery あり", not bad, f"欠落: {bad[:5]}" if bad else "")
    except Exception as e:
        rec("API /library", False, str(e)[:140])

    first = data["library"][0] if data["library"] else None
    if first and first.get("id"):
        try:
            one = get_json(f"{api}/manga/{first['id']}")
            data["manga_one"] = one
            n_lib = len(first.get("gallery") or [])
            n_one = len(one.get("gallery") or []) if isinstance(one, dict) else -1
            rec(f"API /manga/{first['id']} の枚数が /library と一致", n_lib == n_one, f"library={n_lib} manga={n_one}")
            imgs = [img_url(x) for x in (one.get("gallery") or [])[:2]] if isinstance(one, dict) else []
            ok = bool(imgs) and all(url_ok(u) for u in imgs)
            rec("API gallery 画像URLが到達可能（先頭2枚）", ok, "" if ok else ", ".join(imgs)[:200])
        except Exception as e:
            rec(f"API /manga/{first['id']}", False, str(e)[:140])

    for ep in ("/news?site=bizmanga&per_page=50", "/columns?site=bizmanga&per_page=50"):
        try:
            d = get_json(api + ep)
            n = len(d) if isinstance(d, list) else -1
            rec(f"API {ep.split('?')[0]} 件数>0", n > 0, f"{n}件")
        except Exception as e:
            rec(f"API {ep}", False, str(e)[:140])
    return data


def pick_wp_only_id(base, lib):
    """works.js の FALLBACK_WORKS に無い作品IDを選ぶ（WP 接続が生きていないと開けない作品）"""
    ids = [w["id"] for w in lib if w.get("id")]
    if not ids:
        return None, "library が空"
    try:
        src = get_text(f"{base}/js/works.js")
        fallback = set(re.findall(r"\[\s*'([a-z0-9-]+)'\s*,", src))
    except Exception as e:
        return ids[0], f"works.js を取得できず先頭を使用（{str(e)[:60]}）"
    for i in ids:
        if i not in fallback:
            return i, "FALLBACK_WORKS に無い作品"
    return ids[0], "全作品が FALLBACK_WORKS にあるため先頭を使用（WP 接続の確認としては弱い）"


# ------------------------------------------------------------- Browser
# ホーム/制作事例: bm-wp-api.js は 1段目(/works)で bm-data-ready、2段目(/works-new 等)完了で bm-all-data-ready を出す。
# ホームのギャラリーは /works-new を使うので、全データ到着まで待つ
WAIT_ALL = """() => new Promise(res => {
  if (window.BM_NEW_WORKS_DATA) return res('already');
  const t = setTimeout(() => res('timeout'), 25000);
  window.addEventListener('bm-all-data-ready', () => { clearTimeout(t); res('event'); }, { once: true });
})"""

IMG_LOADED = """sel => {
  const imgs = [...document.querySelectorAll(sel)];
  return imgs.some(i => i.complete && i.naturalWidth > 0);
}"""

# 読み込みを試みた（complete）のに幅ゼロ＝壊れている画像。未着手の lazy 画像は数えない
BROKEN_IMGS = """sel => [...document.querySelectorAll(sel)]
  .filter(i => i.complete && i.getAttribute('src') && i.naturalWidth === 0)
  .map(i => i.currentSrc || i.src).slice(0, 5)"""


class PageProbe:
    """1ページぶんのエラー・404の記録"""

    def __init__(self, ctx, host, local_http=False, **kw):
        self.page = ctx.new_page(**kw)
        self.host = host
        self.local_http = local_http
        self.errors, self.bad = [], []
        self.page.on("pageerror", lambda e: self.errors.append("pageerror: " + str(e)[:160]))
        self.page.on("console", self._on_console)
        self.page.on("response", self._on_response)

    def _watched(self, url):
        h = urlparse(url).netloc
        return bool(h) and (h == self.host or h.endswith(WATCH_HOST_SUFFIXES))

    def _on_console(self, m):
        if m.type != "error":
            return
        loc = (m.location or {}).get("url", "") if isinstance(m.location, dict) else ""
        text = m.text
        # http 配信のときだけ: 127.0.0.1 の埋込 iframe に対する CSP frame-src 違反は配信方式の差なので無視
        if self.local_http and "Content Security Policy" in text and ("127.0.0.1" in text or "localhost" in text):
            return
        # 自サイト・WP・素材ホスト起因（または場所不明）のエラーだけ数える。GA/Clarity/HubSpot 等は無視
        if (not loc) or self._watched(loc):
            self.errors.append("console: " + text[:160])

    def _on_response(self, r):
        if self._watched(r.url) and r.status >= 400:
            self.bad.append(f"{r.status} {r.url}")

    def finish(self, label):
        rec(f"{label}: JSエラー無し", not self.errors, "; ".join(self.errors)[:300])
        rec(f"{label}: サイト/WP/素材への 404 無し", not self.bad, "; ".join(self.bad)[:300])
        try:
            self.page.close()
        except Exception:
            pass


def check_browser(base, data):
    import logging
    from playwright.sync_api import sync_playwright
    # コンテキストを閉じた後に届いた中継の残りを asyncio が ERROR ログ（Traceback）として吐くが判定には無関係
    logging.getLogger("asyncio").setLevel(logging.CRITICAL)

    parsed = urlparse(base)
    host = parsed.netloc
    local_http = parsed.scheme == "http"
    use_relay = local_http and base not in CORS_ALLOWED_LOCAL_ORIGINS
    lib = data.get("library") or []
    n_new = len(data.get("works_new") or [])
    wp_id, why = pick_wp_only_id(base, lib)
    print(f"== ブラウザ: {base}  CORS: {'中継（ACAO付与。CORS設定そのものは検証しない）' if use_relay else '実際の許可オリジンのまま'}  検証作品: {wp_id}（{why}）", flush=True)

    def relay_cors(route, request):
        try:
            resp = route.fetch()
            headers = dict(resp.headers)
            headers["access-control-allow-origin"] = "*"
            route.fulfill(response=resp, headers=headers)
        except Exception:
            try:
                route.abort()
            except Exception:
                pass

    def new_ctx(browser, **kw):
        ctx = browser.new_context(**kw)
        if use_relay:
            ctx.route("https://cms.contentsx.jp/**", relay_cors)
        return ctx

    def close_ctx(ctx):
        try:
            ctx.unroute_all(behavior="ignoreErrors")
        except Exception:
            pass
        try:
            ctx.close()
        except Exception:
            pass

    def probe(ctx):
        return PageProbe(ctx, host, local_http=local_http)

    def section(label, fn):
        """区画ごとに例外を隔離: 途中で落ちても残りを続け、落ちた区画は FAIL として残す"""
        try:
            fn()
        except Exception as e:
            rec(f"{label}: 検証が例外で中断", False, f"{type(e).__name__}: {str(e)[:200]}")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        desktop = new_ctx(browser, viewport={"width": 1440, "height": 900})

        def home():
            pr = probe(desktop)
            pg = pr.page
            pg.goto(f"{base}/index.html", wait_until="load")
            how = pg.evaluate(WAIT_ALL)
            pg.wait_for_timeout(800)
            hero = pg.locator("#bmHeroWorksBg .bm-hero-works-cover").count()
            rec("ホーム: Hero マーキーに表紙がある", hero > 0, f"{hero}枚 (data:{how})")
            cards = pg.locator(".bm-gallery-card").count()
            # ページ本体（js/bm-home.js）と同じ計算: /works-new を 横読み/縦読み に分け、各グループ MAX_PER_GROUP(10) 件まで
            calc = pg.evaluate("""() => {
              const d = window.BM_NEW_WORKS_DATA || [];
              const isV = x => !!(window.bmViewType && window.bmViewType.isForcedVertical(x));
              const v = d.filter(isV).length, m = d.length - v;
              return { got: d.length, expected: Math.min(10, m) + Math.min(10, v), manga: m, vertical: v };
            }""")
            rec("ホーム: /works-new をブラウザでも同じ件数で受信（フォールバックしていない）", calc["got"] == n_new and n_new > 0, f"ブラウザ={calc['got']} API={n_new}")
            rec("ホーム: ギャラリーのカード数が仕様どおり（横読み/縦読み 各10件まで）", cards == calc["expected"] and cards > 0,
                f"画面={cards} 期待={calc['expected']}（横読み{calc['manga']}件・縦読み{calc['vertical']}件）")
            if not use_relay:
                rec("ホーム: WP API を実際の CORS 許可設定のまま取得できた", calc["got"] == n_new and n_new > 0, base)
            if cards:
                pg.locator(".bm-gallery-card").first.scroll_into_view_if_needed()
                pg.locator(".bm-gallery-card").first.click()
                try:
                    pg.wait_for_url("**/biz-library?manga=*", timeout=10000)
                    rec("ホーム: ギャラリーカードのクリックで biz-library?manga= へ遷移", True, pg.url.split("/")[-1])
                except Exception:
                    rec("ホーム: ギャラリーカードのクリックで biz-library?manga= へ遷移", False, pg.url)
            pr.finish("ホーム")

        def works():
            pr = probe(desktop)
            pg = pr.page
            pg.goto(f"{base}/works.html", wait_until="load")
            pg.evaluate(WAIT_ALL)
            pg.wait_for_timeout(800)
            sel = "#bmWorksGrid .bm-works-card, #bmWorksGrid [data-build-static]"
            n_cards = pg.locator(sel).count()
            rec("制作事例: カードが表示される", n_cards > 0, f"{n_cards}件")
            if n_cards:
                card = pg.locator(sel).first
                card.scroll_into_view_if_needed()
                card.click()
                try:
                    pg.wait_for_selector("#workDetailOverlay.active", timeout=10000)
                    opened = True
                except Exception:
                    opened = False
                rec("制作事例: カードクリックでモーダルが開く", opened)
                if opened:
                    try:
                        pg.wait_for_function(IMG_LOADED, arg="#workDetailCarousel img", timeout=20000)
                        rec("制作事例: モーダル内の漫画画像が読み込まれる", True)
                    except Exception:
                        rec("制作事例: モーダル内の漫画画像が読み込まれる", False, "20秒以内に naturalWidth>0 の画像が無い")
                    pg.wait_for_timeout(1500)
                    broken = pg.evaluate(BROKEN_IMGS, "#workDetailCarousel img")
                    rec("制作事例: モーダル内に読み込み失敗の画像が無い", not broken, "; ".join(broken)[:300])
                    pg.locator("#workDetailClose").click()
                    pg.wait_for_timeout(500)
                    rec("制作事例: モーダルを閉じられる", pg.locator("#workDetailOverlay.active").count() == 0)
            pr.finish("制作事例")

        def library():
            pr = probe(desktop)
            pg = pr.page
            pg.goto(f"{base}/biz-library.html", wait_until="load")
            # works.js は自前で /library を取得し BM_* グローバルもイベントも出さないので、カード数の到達で待つ
            try:
                pg.wait_for_function("n => document.querySelectorAll('#worksGrid > *').length === n", arg=len(lib), timeout=25000)
            except Exception:
                pass
            n_grid = pg.locator("#worksGrid > *").count()
            rec("ビズ書庫: グリッドの作品数が /library と一致（全カードが DOM にある）", n_grid == len(lib) and n_grid > 0, f"画面={n_grid} API={len(lib)}")
            if n_grid:
                pg.locator("#worksGrid > *").first.click()
                try:
                    pg.wait_for_selector("#mangaModal", state="visible", timeout=10000)
                    opened = True
                except Exception:
                    opened = False
                rec("ビズ書庫: クリックでビューアが開く", opened)
                if opened:
                    try:
                        pg.wait_for_function(IMG_LOADED, arg="#mangaModal img", timeout=20000)
                        rec("ビズ書庫: ビューアの漫画画像が読み込まれる", True)
                    except Exception:
                        rec("ビズ書庫: ビューアの漫画画像が読み込まれる", False, "20秒以内に画像が読み込まれない")
                    pg.wait_for_timeout(1500)
                    broken = pg.evaluate(BROKEN_IMGS, "#mangaModal img")
                    rec("ビズ書庫: ビューア内に読み込み失敗の画像が無い", not broken, "; ".join(broken)[:300])
                    qr = pg.evaluate("() => document.documentElement.classList.contains('qr-mode')")
                    rec("ビズ書庫: サイト内クリックでは qr-mode にならない", not qr)
                    pg.locator("#modalClose").click()
                    pg.wait_for_timeout(600)
                    rec("ビズ書庫: ビューアを閉じられる", not pg.locator("#mangaModal").is_visible())
            pr.finish("ビズ書庫")

        def qr_direct():
            qr_ctx = new_ctx(browser, viewport={"width": 1440, "height": 900})
            pr = probe(qr_ctx)
            pg = pr.page
            pg.goto(f"{base}/biz-library.html?manga={wp_id}", wait_until="load")
            try:
                pg.wait_for_selector("#mangaModal", state="visible", timeout=15000)
                pg.wait_for_function(IMG_LOADED, arg="#mangaModal img", timeout=20000)
                rec(f"QR直リンク ?manga={wp_id}: ビューアが自動で開き画像が出る（/manga/{{id}} 経由）", True)
            except Exception:
                rec(f"QR直リンク ?manga={wp_id}: ビューアが自動で開き画像が出る（/manga/{{id}} 経由）", False)
            qr = pg.evaluate("() => document.documentElement.classList.contains('qr-mode')")
            rec("QR直リンク: referrer 無しなら qr-mode になる（BUGS #010）", qr)
            pr.finish("QR直リンク")
            close_ctx(qr_ctx)

        def internal_nav():
            pr = probe(desktop)
            pg = pr.page
            pg.goto(f"{base}/biz-library.html?manga={wp_id}", wait_until="load", referer=f"{base}/index.html")
            pg.wait_for_timeout(1500)
            qr = pg.evaluate("() => document.documentElement.classList.contains('qr-mode')")
            rec("サイト内遷移 ?manga=: referrer ありなら qr-mode にならない", not qr)
            pr.finish("サイト内遷移")

        def embed():
            pr = probe(desktop)
            pg = pr.page
            pg.goto(f"{base}/embed-viewer.html?manga={wp_id}&manual=1", wait_until="load")
            try:
                pg.wait_for_function(IMG_LOADED, arg="#viewer img", timeout=20000)
                rec("埋込ビューア embed-viewer?manga=&manual=1: 画像が出る", True)
            except Exception:
                rec("埋込ビューア embed-viewer?manga=&manual=1: 画像が出る", False)
            pr.finish("埋込ビューア")

        def mobile():
            ctx = new_ctx(browser, viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
                          user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
            pr = probe(ctx)
            pg = pr.page
            pg.goto(f"{base}/biz-library.html?manga={wp_id}", wait_until="load")
            try:
                pg.wait_for_selector("#mangaModal", state="visible", timeout=15000)
                pg.wait_for_function(IMG_LOADED, arg="#mangaModal img", timeout=20000)
                rec("スマホ(390px) ?manga=: ビューアが開き画像が出る", True)
            except Exception:
                rec("スマホ(390px) ?manga=: ビューアが開き画像が出る", False)
            # works.js: PC以外で見開き(spread)作品を開くと縦スクロール(mode-vertical)に切り替わる（SPデフォルト）。
            # #mobileView は見開き専用の要素なので、縦スクロール時は非表示が正しい。
            mode = pg.evaluate("() => { const c=document.getElementById('mangaModal').classList; return c.contains('mode-vertical') ? 'vertical' : (c.contains('mode-spread') ? 'spread' : 'none') }")
            rec("スマホ(390px): 縦スクロールモード(mode-vertical)で開く（SPデフォルト）", mode == "vertical", f"mode={mode}")
            try:
                pg.wait_for_function(IMG_LOADED, arg="#modalManga img", timeout=15000)
                rec("スマホ(390px): 縦スクロール枠(#modalManga)に画像が出る", True)
            except Exception:
                rec("スマホ(390px): 縦スクロール枠(#modalManga)に画像が出る", False)
            hs = pg.evaluate("() => document.body.scrollWidth > window.innerWidth")
            rec("スマホ(390px): 横スクロール無し", not hs)
            pr.finish("スマホ")
            close_ctx(ctx)

        section("ホーム", home)
        section("制作事例", works)
        section("ビズ書庫", library)
        if wp_id:
            section("QR直リンク", qr_direct)
            section("サイト内遷移", internal_nav)
            section("埋込ビューア", embed)
        close_ctx(desktop)
        if wp_id:
            section("スマホ", mobile)
        browser.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default=f"http://127.0.0.1:{DEFAULT_PORT}", help="確認対象のサイトURL（末尾スラッシュ無し）")
    ap.add_argument("--api", default=DEFAULT_API, help="WP API のベースURL（Python 側の確認にだけ効く）")
    ap.add_argument("--api-only", action="store_true", help="WP API の確認だけ行う（ブラウザを使わない）")
    ap.add_argument("--serve", metavar="DIR", help="このディレクトリを内蔵サーバーで配信して検証する（--base より優先）")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"--serve のポート（既定 {DEFAULT_PORT}＝WP の CORS 許可オリジン）")
    args = ap.parse_args()
    base = args.base.rstrip("/")
    httpd = None
    if args.serve:
        try:
            httpd = start_server(os.path.abspath(args.serve), args.port)
        except OSError as e:
            print(f"内蔵サーバーを 127.0.0.1:{args.port} で起動できません（{e}）。--port で別ポートを指定するか、使用中のプロセスを止めてください", file=sys.stderr)
            sys.exit(2)
        base = f"http://127.0.0.1:{args.port}"

    print(f"== WP API: {args.api}")
    data = check_api(args.api)
    if not args.api_only:
        try:
            check_browser(base, data)
        except ImportError:
            rec("playwright が見つからない", False, "pip install playwright && python3 -m playwright install chromium")
        except Exception as e:
            rec("ブラウザ検証を開始できない（Chromium 未導入・起動失敗など）", False, f"{type(e).__name__}: {str(e)[:200]}")
        finally:
            if httpd:
                httpd.shutdown()
    elif httpd:
        httpd.shutdown()

    n_fail = sum(1 for _, ok, _ in RESULTS if not ok)
    print("\n== 結果: {} PASS / {} FAIL".format(len(RESULTS) - n_fail, n_fail))
    for name, ok, detail in RESULTS:
        if not ok:
            print(f"   FAIL {name}" + (f"  — {detail}" if detail else ""))
    sys.exit(1 if n_fail else 0)


if __name__ == "__main__":
    main()
