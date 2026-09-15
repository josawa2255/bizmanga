#!/usr/bin/env python3
"""
smoke-manga-wp.py — BizManga「漫画の表示」と「WordPress接続」のスモークテスト

目的（2026-09-15 平澤指示）: 漫画ビューア / ホームギャラリー / 制作事例モーダル / 埋込ビューア と
WP API 接続が「壊れていないか」を、人の目に頼らず機械的に確認する。
対応するチェックリスト: docs/REVIEW-MANGA-WP.md §1

使い方:
  python3 tools/smoke-manga-wp.py --serve .                               # このリポジトリを内蔵サーバーで配信して検証（推奨）
  python3 tools/smoke-manga-wp.py --base https://bizmanga.contentsx.jp   # 本番にも当てられる
  python3 tools/smoke-manga-wp.py --api-only                              # WP API だけ

ローカル検証の仕組み:
  - 内蔵サーバーは GitHub Pages と同じく拡張子なしURL（/biz-library → biz-library.html）を解決する
    （python -m http.server では `biz-library?manga=` へのサイト内遷移が 404 になる）
  - WP API は本番オリジンにしか CORS を許可していない（BUGS.md #009）ので、ブラウザ内の
    API リクエストを Playwright で中継し Access-Control-Allow-Origin を付けて返す（応答本体は本番のまま）
  - http 配信では CSP の frame-src（https: のみ）で埋込 iframe の違反ログが出るため、その1種類だけ無視する

終了コード: 全 PASS で 0、1つでも FAIL なら 1。
必要なもの: Python 3.9+、playwright（pip install playwright && python3 -m playwright install chromium）
"""
import argparse
import json
import os
import sys
import threading
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

DEFAULT_API = "https://cms.contentsx.jp/wp-json/contentsx/v1"
DEFAULT_BASE = "http://127.0.0.1:8127"
RESULTS = []  # (name, ok, detail)


def rec(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS  " if ok else "FAIL  ") + name + ("  — " + detail if detail else ""), flush=True)


def get_json(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": "bm-smoke/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


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
class CleanUrlHandler(SimpleHTTPRequestHandler):
    """GitHub Pages 互換: /foo → foo.html、/dir → dir/index.html。キャッシュ無効。ログは黙らせる"""

    def translate_path(self, path):
        full = super().translate_path(path)
        if os.path.isfile(full):
            return full
        if os.path.isdir(full) and os.path.isfile(os.path.join(full, "index.html")):
            return os.path.join(full, "index.html")
        if not os.path.splitext(full)[1] and os.path.isfile(full + ".html"):
            return full + ".html"
        return full

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


def start_server(directory, port):
    handler = partial(CleanUrlHandler, directory=directory)
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


# ------------------------------------------------------------- Browser
WAIT_DATA = """() => new Promise(res => {
  if (window.BM_LIBRARY_DATA || window.BM_NEW_WORKS_DATA || window.BM_WORKS_DATA) return res('already');
  const t = setTimeout(() => res('timeout'), 20000);
  const done = () => { clearTimeout(t); res('event'); };
  window.addEventListener('bm-all-data-ready', done, { once: true });
  window.addEventListener('bm-data-ready', done, { once: true });
})"""

IMG_LOADED = """sel => {
  const imgs = [...document.querySelectorAll(sel)];
  return imgs.some(i => i.complete && i.naturalWidth > 0);
}"""


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

    def _on_console(self, m):
        if m.type != "error":
            return
        loc = (m.location or {}).get("url", "") if isinstance(m.location, dict) else ""
        text = m.text
        # http 配信のときだけ: CSP frame-src（https: のみ）の違反ログは配信方式の差なので無視
        if self.local_http and "Content Security Policy" in text and "frame-src" in text:
            return
        # 自サイト起因（または場所不明）のエラーだけ数える。GA/Clarity/HubSpot 等の外部は無視
        if (not loc) or (self.host in loc):
            self.errors.append("console: " + text[:160])

    def _on_response(self, r):
        if self.host in r.url and r.status >= 400:
            self.bad.append(f"{r.status} {r.url}")

    def finish(self, label):
        rec(f"{label}: JSエラー無し", not self.errors, "; ".join(self.errors)[:300])
        rec(f"{label}: 自サイト404無し", not self.bad, "; ".join(self.bad)[:300])
        self.page.close()


def check_browser(base, data, api):
    import logging
    from playwright.sync_api import sync_playwright
    # コンテキストを閉じた後に届いた中継リクエストの残りを asyncio が ERROR ログ（Traceback）として吐くが、
    # 判定には無関係なので黙らせる（判定は RESULTS と終了コードで行う）
    logging.getLogger("asyncio").setLevel(logging.CRITICAL)

    host = urlparse(base).netloc
    local_http = urlparse(base).scheme == "http"
    api_origin = "{0.scheme}://{0.netloc}".format(urlparse(api))
    lib = data.get("library") or []
    first_id = lib[0]["id"] if lib and lib[0].get("id") else None
    n_new = len(data.get("works_new") or [])

    def relay_cors(route, request):
        """WP API はローカルオリジンに CORS を許可しないので、本番の応答をそのまま中継して ACAO を足す"""
        try:
            resp = route.fetch()
            headers = dict(resp.headers)
            headers["access-control-allow-origin"] = "*"
            route.fulfill(response=resp, headers=headers)
        except Exception:
            try:
                route.abort()
            except Exception:
                pass  # コンテキストを閉じた後に届いた分は無視

    def new_ctx(browser, **kw):
        ctx = browser.new_context(**kw)
        if local_http:
            ctx.route(api_origin + "/**", relay_cors)
        return ctx

    def probe(ctx):
        return PageProbe(ctx, host, local_http=local_http)

    def close_ctx(ctx):
        # 飛んでいる途中の中継リクエストがあっても例外にしない（Playwright 推奨手順）。
        # networkidle 待ちは GA/Clarity 等の外部ビーコンで終わらないことがあるので使わない
        try:
            ctx.unroute_all(behavior="ignoreErrors")
        except Exception:
            pass
        ctx.close()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        desktop = new_ctx(browser, viewport={"width": 1440, "height": 900})

        # --- ホーム -------------------------------------------------------
        pr = probe(desktop)
        pg = pr.page
        pg.goto(f"{base}/index.html", wait_until="load")
        how = pg.evaluate(WAIT_DATA)
        pg.wait_for_timeout(1500)
        hero = pg.locator("#bmHeroWorksBg .bm-hero-works-cover").count()
        rec("ホーム: Hero マーキーに表紙がある", hero > 0, f"{hero}枚 (data:{how})")
        cards = pg.locator(".bm-gallery-card").count()
        # ページ本体（js/bm-home.js）と同じ計算: /works-new を 横読み/縦読み の2グループに分け、各グループ10件まで表示
        calc = pg.evaluate("""() => {
          const d = window.BM_NEW_WORKS_DATA || [];
          const isV = x => !!(window.bmViewType && window.bmViewType.isForcedVertical(x));
          const v = d.filter(isV).length, m = d.length - v;
          return { got: d.length, expected: Math.min(10, m) + Math.min(10, v), manga: m, vertical: v };
        }""")
        rec("ホーム: /works-new をブラウザでも同じ件数で受信（フォールバックしていない）", calc["got"] == n_new and n_new > 0, f"ブラウザ={calc['got']} API={n_new}")
        rec("ホーム: ギャラリーのカード数が仕様どおり（横読み/縦読み 各10件まで）", cards == calc["expected"] and cards > 0,
            f"画面={cards} 期待={calc['expected']}（横読み{calc['manga']}件・縦読み{calc['vertical']}件）")
        if cards:
            pg.locator(".bm-gallery-card").first.scroll_into_view_if_needed()
            pg.locator(".bm-gallery-card").first.click()
            try:
                pg.wait_for_url("**/biz-library?manga=*", timeout=10000)
                rec("ホーム: ギャラリーカードのクリックで biz-library?manga= へ遷移", True, pg.url.split("/")[-1])
            except Exception:
                rec("ホーム: ギャラリーカードのクリックで biz-library?manga= へ遷移", False, pg.url)
        pr.finish("ホーム")

        # --- 制作事例 -----------------------------------------------------
        pr = probe(desktop)
        pg = pr.page
        pg.goto(f"{base}/works.html", wait_until="load")
        pg.evaluate(WAIT_DATA)
        pg.wait_for_timeout(1500)
        n_cards = pg.locator("#bmWorksGrid .bm-works-card, #bmWorksGrid [data-build-static]").count()
        rec("制作事例: カードが表示される", n_cards > 0, f"{n_cards}件")
        if n_cards:
            card = pg.locator("#bmWorksGrid .bm-works-card, #bmWorksGrid [data-build-static]").first
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
                pg.locator("#workDetailClose").click()
                pg.wait_for_timeout(500)
                rec("制作事例: モーダルを閉じられる", pg.locator("#workDetailOverlay.active").count() == 0)
        pr.finish("制作事例")

        # --- ビズ書庫 -----------------------------------------------------
        pr = probe(desktop)
        pg = pr.page
        pg.goto(f"{base}/biz-library.html", wait_until="load")
        pg.evaluate(WAIT_DATA)
        pg.wait_for_timeout(1500)
        n_grid = pg.locator("#worksGrid > *").count()
        paginated = pg.locator("#gridPagination *").count() > 0
        ok_grid = n_grid > 0 and (n_grid == len(lib) or paginated)
        rec("ビズ書庫: グリッドの作品数が /library と一致（またはページ送りあり）", ok_grid, f"画面={n_grid} API={len(lib)} pagination={paginated}")
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
                qr = pg.evaluate("() => document.documentElement.classList.contains('qr-mode')")
                rec("ビズ書庫: サイト内クリックでは qr-mode にならない", not qr)
                pg.locator("#modalClose").click()
                pg.wait_for_timeout(600)
                rec("ビズ書庫: ビューアを閉じられる", not pg.locator("#mangaModal").is_visible())
        pr.finish("ビズ書庫")

        # --- QR直リンク（referrer なし） ------------------------------------
        if first_id:
            qr_ctx = new_ctx(browser, viewport={"width": 1440, "height": 900})
            pr = probe(qr_ctx)
            pg = pr.page
            pg.goto(f"{base}/biz-library.html?manga={first_id}", wait_until="load")
            try:
                pg.wait_for_selector("#mangaModal", state="visible", timeout=15000)
                pg.wait_for_function(IMG_LOADED, arg="#mangaModal img", timeout=20000)
                rec(f"QR直リンク ?manga={first_id}: ビューアが自動で開き画像が出る", True)
            except Exception:
                rec(f"QR直リンク ?manga={first_id}: ビューアが自動で開き画像が出る", False)
            qr = pg.evaluate("() => document.documentElement.classList.contains('qr-mode')")
            rec("QR直リンク: referrer 無しなら qr-mode になる（BUGS #010）", qr)
            pr.finish("QR直リンク")
            close_ctx(qr_ctx)

            # --- サイト内遷移（referrer あり） ------------------------------
            pr = probe(desktop)
            pg = pr.page
            pg.goto(f"{base}/biz-library.html?manga={first_id}", wait_until="load", referer=f"{base}/index.html")
            pg.wait_for_timeout(1500)
            qr = pg.evaluate("() => document.documentElement.classList.contains('qr-mode')")
            rec("サイト内遷移 ?manga=: referrer ありなら qr-mode にならない", not qr)
            pr.finish("サイト内遷移")

            # --- 埋込ビューア -------------------------------------------------
            pr = probe(desktop)
            pg = pr.page
            pg.goto(f"{base}/embed-viewer.html?manga={first_id}&manual=1", wait_until="load")
            try:
                pg.wait_for_function(IMG_LOADED, arg="#viewer img", timeout=20000)
                rec("埋込ビューア embed-viewer?manga=&manual=1: 画像が出る", True)
            except Exception:
                rec("埋込ビューア embed-viewer?manga=&manual=1: 画像が出る", False)
            pr.finish("埋込ビューア")

        close_ctx(desktop)

        # --- スマホ ---------------------------------------------------------
        if first_id:
            mobile = new_ctx(browser, viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
                                         user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
            pr = probe(mobile)
            pg = pr.page
            pg.goto(f"{base}/biz-library.html?manga={first_id}", wait_until="load")
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
            close_ctx(mobile)

        browser.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default=DEFAULT_BASE, help="確認対象のサイトURL（末尾スラッシュ無し）")
    ap.add_argument("--api", default=DEFAULT_API, help="WP API のベースURL")
    ap.add_argument("--api-only", action="store_true", help="WP API の確認だけ行う（ブラウザを使わない）")
    ap.add_argument("--serve", metavar="DIR", help="このディレクトリを内蔵サーバーで配信して検証する（--base より優先）")
    ap.add_argument("--port", type=int, default=8127, help="--serve のポート（既定 8127）")
    args = ap.parse_args()
    base = args.base.rstrip("/")
    httpd = None
    if args.serve:
        httpd = start_server(os.path.abspath(args.serve), args.port)
        base = f"http://127.0.0.1:{args.port}"

    print(f"== WP API: {args.api}")
    data = check_api(args.api)
    if not args.api_only:
        print(f"== ブラウザ: {base}")
        try:
            check_browser(base, data, args.api)
        except ImportError:
            rec("playwright が見つからない", False, "pip install playwright && python3 -m playwright install chromium")

    if httpd:
        httpd.shutdown()
    n_fail = sum(1 for _, ok, _ in RESULTS if not ok)
    print("\n== 結果: {} PASS / {} FAIL".format(len(RESULTS) - n_fail, n_fail))
    for name, ok, detail in RESULTS:
        if not ok:
            print(f"   FAIL {name}" + (f"  — {detail}" if detail else ""))
    sys.exit(1 if n_fail else 0)


if __name__ == "__main__":
    main()
