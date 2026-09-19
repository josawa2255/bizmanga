"""Live WP, fallback, category modal and HTTPS-origin preview regressions.

HTTPS previews serve local files only inside this browser context; nothing is deployed.
All non-GET requests are blocked. Run against serve.py on port 5500.
"""

import argparse
import pathlib
import json
import mimetypes
import urllib.parse
import re
from playwright.sync_api import sync_playwright
from test_responsive_layout import SCAN, violations


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:5500")
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument(
        "--only", help="Scenario group: modal, fallback, testimonial, https"
    )
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parent.parent
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    results = []

    def rec(label, ok, detail=None):
        results.append(dict(label=label, ok=bool(ok), detail=detail))
        print(("PASS " if ok else "FAIL ") + label, flush=True)
        (out / "results.json").write_text(
            json.dumps(results, ensure_ascii=False, indent=2), encoding="utf8"
        )

    with sync_playwright() as p:
        for engine in ["chromium", "webkit"]:
            b = getattr(p, engine).launch()
            c = b.new_context(
                ignore_https_errors=True, has_touch=True, service_workers="block"
            )
            pg = c.new_page()
            pg.set_default_timeout(20000)

            def post_guard(route):
                if (
                    route.request.method not in ["GET", "HEAD"]
                    or route.request.url.startswith("https://")
                    and re.search(
                        r"google(tagmanager|adservices|ads|analytics)|clarity\.ms|hubspot|hs-scripts|hs-analytics|doubleclick",
                        route.request.url,
                    )
                ):
                    route.abort()
                else:
                    route.continue_()

            c.route("**/*", post_guard)
            for w, h in (
                [(390, 844), (820, 1180), (1180, 820)]
                if not args.only or args.only == "modal"
                else []
            ):
                pg.set_viewport_size({"width": w, "height": h})
                for route in ["works", "works/category/product"]:
                    try:
                        pg.goto(args.base + "/" + route, wait_until="domcontentloaded")
                        pg.wait_for_selector(
                            "#bmCategoryFilter .bm-filter-btn"
                        ) if route == "works" else pg.wait_for_timeout(800)
                        pg.locator(
                            "#bmWorksGrid .bm-works-card, [data-build-static]"
                            if route == "works"
                            else ".bm-works-card"
                        ).first.click()
                        pg.wait_for_selector("#workDetailOverlay.active")
                        pg.wait_for_timeout(800)
                        rec(
                            f"{engine} {route} detail {w}",
                            pg.locator("#workDetailOverlay").is_visible(),
                        )
                        pg.screenshot(
                            path=str(
                                out
                                / (
                                    engine
                                    + "-"
                                    + route.replace("/", "_")
                                    + "-"
                                    + str(w)
                                    + ".png"
                                )
                            )
                        )
                    except Exception as e:
                        rec(f"{engine} {route} detail {w}", False, str(e))
            # Public data failure: local fallback should still render content.
            c.route("https://cms.contentsx.jp/**", lambda r: r.abort())
            for route, sel in (
                [
                    ("index", ".bm-gallery-card"),
                    ("works", "#bmWorksGrid > *"),
                    ("artists", ".art-card"),
                ]
                if not args.only or args.only == "fallback"
                else []
            ):
                try:
                    pg.goto(args.base + "/" + route, wait_until="domcontentloaded")
                    pg.wait_for_timeout(3500)
                    rec(
                        f"{engine} WP fallback {route}",
                        pg.locator(sel).count() > 0,
                        pg.locator(sel).count(),
                    )
                except Exception as e:
                    rec(f"{engine} WP fallback {route}", False, str(e))
            c.unroute("https://cms.contentsx.jp/**")
            # The testimonial endpoint currently has no records: test a clearly mocked long record.
            fixture = {
                "id": 999999,
                "heading": "表示確認用の長いお客様の声",
                "tag": "表示確認",
                "content": "<h2>検証用見出し</h2>"
                + (
                    "<p>これは表示確認用の文章です。画面幅に合わせて読みやすく折り返されることを確認します。</p>"
                    * 8
                )
                + '<img src="/material/images/logo/bizmanga-logo.webp" alt="表示確認"><p><a href="/contact">お問い合わせはこちらから</a></p>',
            }
            c.route(
                "**/testimonials/999999",
                lambda r: r.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(fixture),
                ),
            )
            for w, h in (
                [(320, 568), (820, 1180)]
                if not args.only or args.only == "testimonial"
                else []
            ):
                try:
                    pg.set_viewport_size({"width": w, "height": h})
                    pg.goto(
                        args.base + "/testimonial-detail?id=999999",
                        wait_until="domcontentloaded",
                    )
                    pg.wait_for_timeout(1000)
                    r = pg.evaluate(SCAN)
                    rec(
                        f"{engine} testimonial fixture {w}",
                        not violations(r),
                        violations(r),
                    )
                    pg.screenshot(path=str(out / f"{engine}-testimonial-{w}.png"))
                except Exception as e:
                    rec(f"{engine} testimonial fixture {w}", False, str(e))

            # Serve the working tree at the production HTTPS origin in this browser only.
            # This is a local response override, not a deploy; iframe CSP and API origins remain real.
            def local_https(route):
                u = urllib.parse.urlparse(route.request.url)
                rel = urllib.parse.unquote(u.path).lstrip("/") or "index.html"
                f = (root / rel).resolve()
                if not f.is_relative_to(root):
                    route.fulfill(status=403, body="")
                    return
                if not f.suffix:
                    f = f.with_suffix(".html")
                if f.is_file():
                    route.fulfill(
                        status=200,
                        content_type=mimetypes.guess_type(str(f))[0]
                        or "application/octet-stream",
                        body=f.read_bytes(),
                    )
                else:
                    route.fulfill(status=404, body="Not found")

            c.route("https://bizmanga.contentsx.jp/**", local_https)
            for w, h in (
                [(820, 1180), (1180, 820)]
                if not args.only or args.only == "https"
                else []
            ):
                try:
                    pg.set_viewport_size({"width": w, "height": h})
                    pg.goto(
                        "https://bizmanga.contentsx.jp/", wait_until="domcontentloaded"
                    )
                    pg.locator("#s3dSection").evaluate(
                        'e=>e.scrollIntoView({behavior:"instant"})'
                    )
                    pg.wait_for_timeout(3000)
                    for iframe in pg.locator("#s3dSection iframe").all():
                        iframe.evaluate('e=>e.scrollIntoView({behavior:"instant"})')
                        pg.wait_for_timeout(2500)
                    pg.locator("#s3dSection").evaluate(
                        'e=>e.scrollIntoView({behavior:"instant"})'
                    )
                    frames = [f for f in pg.frames if "embed-viewer" in f.url]
                    states = [
                        f.evaluate(
                            "()=>({images:[...document.images].filter(i=>i.complete&&i.naturalWidth).length})"
                        )
                        for f in frames
                    ]
                    rec(
                        f"{engine} HTTPS local preview embedded manga {w}",
                        len(states) >= 2 and all(x["images"] > 0 for x in states),
                        states,
                    )
                    boxes = pg.locator(".s3d-screen").evaluate_all(
                        "es=>es.map(e=>{let r=e.getBoundingClientRect();return {left:r.left,right:r.right}})"
                    )
                    rec(
                        f"{engine} 3D screens fit {w}",
                        all(x["left"] >= -1 and x["right"] <= w + 1 for x in boxes),
                        boxes,
                    )
                    pg.screenshot(path=str(out / f"{engine}-https-3d-{w}.png"))
                except Exception as e:
                    rec(f"{engine} HTTPS local preview {w}", False, str(e))
            b.close()

    failed = sum(not r["ok"] for r in results)
    print(f"{len(results) - failed} PASS / {failed} FAIL")
    return bool(failed)


if __name__ == "__main__":
    raise SystemExit(main())
