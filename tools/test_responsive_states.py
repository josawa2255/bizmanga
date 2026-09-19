"""Interactive responsive regressions. Run against serve.py on port 5500.

All POSTs (including CRM, HubSpot and analytics) are intercepted, never transmitted.
python tools/test_responsive_states.py --output <temporary-directory>
"""

import argparse
import json
import pathlib
import re
from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:5500")
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument(
        "--only", help="Run scenario names matching this regular expression"
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    results = []

    def check(label, ok, detail=None):
        results.append(dict(label=label, ok=bool(ok), detail=detail))
        (args.output / "states.json").write_text(
            json.dumps(results, ensure_ascii=False, indent=2), encoding="utf8"
        )
        print(("PASS " if ok else "FAIL ") + label, flush=True)

    with sync_playwright() as p:
        for engine in ["chromium", "webkit"]:
            browser = getattr(p, engine).launch(headless=True)
            ctx = browser.new_context(
                ignore_https_errors=True, has_touch=True, service_workers="block"
            )
            post_status = [200]
            posts = []
            sending_states = []

            def guard(route):
                req = route.request
                if req.method not in ["GET", "HEAD"]:
                    posts.append(req.method)
                    sending_states.append(
                        page.locator(".bm-form-submit.is-sending:disabled").count() > 0
                    )
                    route.fulfill(
                        status=post_status[0],
                        content_type="application/json",
                        body="{}",
                    )
                elif req.url.startswith("https://") and re.search(
                    r"google(tagmanager|adservices|ads|analytics)|clarity\.ms|hubspot|hs-scripts|hs-analytics|doubleclick",
                    req.url,
                ):
                    route.abort()
                else:
                    route.continue_()

            ctx.route("**/*", guard)
            page = ctx.new_page()
            page.set_default_timeout(20000)

            def open_page(path, w=820, h=1180):
                page.set_viewport_size(dict(width=w, height=h))
                page.goto(args.base + "/" + path, wait_until="domcontentloaded")
                page.evaluate("document.fonts.ready")
                page.wait_for_timeout(500)

            def shot(name):
                page.screenshot(
                    path=str(args.output / (engine + "-" + name + ".png")),
                    animations="disabled",
                )

            def run(name, fn):
                if args.only and not re.search(args.only, name):
                    return
                try:
                    fn()
                except Exception as e:
                    check(engine + " " + name, False, str(e))

            def nav():
                positions = []
                for path in [
                    "pricing",
                    "artists",
                    "company-manga",
                    "strength",
                    "bizanime",
                ]:
                    open_page(path, 1440, 900)
                    positions.append(page.locator("#bmNav").bounding_box()["x"])
                check(
                    engine + " desktop header alignment",
                    max(positions) - min(positions) < 2,
                    positions,
                )
                for width in [
                    767,
                    768,
                    769,
                    899,
                    900,
                    901,
                    1023,
                    1024,
                    1025,
                    1099,
                    1100,
                    1101,
                ]:
                    page.set_viewport_size(dict(width=width, height=900))
                    page.wait_for_timeout(100)
                    check(
                        engine + f" header breakpoint {width}",
                        page.locator("#bmHamburger").is_visible() == (width <= 1024),
                    )
                for width in [820, 1180]:
                    open_page("pricing", width, 1180)
                    if width <= 1024:
                        page.locator("#bmHamburger").tap()
                    toggle = page.locator(".bm-nav-dropdown-toggle").filter(
                        has_text="サービス"
                    )
                    toggle.tap()
                    page.wait_for_timeout(400)
                    check(
                        engine + f" touch submenu first tap {width}",
                        page.url.endswith("/pricing")
                        and toggle.get_attribute("aria-expanded") == "true",
                    )
                    check(
                        engine + f" submenu links reachable {width}",
                        page.locator(".bm-nav-megamenu-item")
                        .filter(has_text="会社紹介マンガ")
                        .is_visible(),
                    )
                    shot("nav-" + str(width))
                    toggle.tap()
                    page.wait_for_url("**/product-manga")
                    check(
                        engine + f" touch parent second tap {width}",
                        page.url.endswith("/product-manga"),
                    )
                open_page("pricing", 1440, 900)
                toggle = page.locator(
                    ".bm-nav-megamenu-wrap > .bm-nav-dropdown-toggle"
                ).first
                toggle.focus()
                page.wait_for_timeout(500)
                menu = toggle.locator("..").locator(".bm-nav-megamenu")
                check(engine + " desktop keyboard opens submenu", menu.is_visible())
                page.keyboard.press("Escape")
                page.wait_for_timeout(500)
                check(
                    engine + " desktop Escape closes focused submenu",
                    not menu.is_visible(),
                )

            run("navigation", nav)

            def artist():
                open_page("artists", 390, 844)
                buttons = page.locator(".bm-fab__btn")
                check(
                    engine + " artist compact icons",
                    buttons.evaluate_all("""es=>es.every(e=>{
                    const b=e.getBoundingClientRect(), i=e.querySelector('.bm-fab__icon-box');
                    return b.width>=48 && b.height>=48 && getComputedStyle(i).display!=='none';})"""),
                )
                page.locator(".art-fab-toggle").click()
                page.wait_for_timeout(400)
                check(
                    engine + " artist expanded CTA fits",
                    buttons.evaluate_all(
                        """es=>es.every(e=>{const r=e.getBoundingClientRect();return r.left>=16&&r.right<=innerWidth-16&&r.width>=150;})"""
                    ),
                )
                shot("artist-fab-expanded")
                page.locator(".art-card").first.click()
                page.locator(".art-modal__cta").scroll_into_view_if_needed()
                check(
                    engine + " artist modal hides background CTA",
                    not page.locator(".bm-fab").is_visible(),
                )
                shot("artist-modal")
                page.keyboard.press("Escape")
                check(
                    engine + " artist CTA state restored",
                    page.locator(".bm-fab.is-open").is_visible(),
                )
                open_page("artists", 1920, 600)
                check(
                    engine + " artist hero contains both CTAs",
                    page.evaluate(
                        """()=>{const h=document.querySelector('.art-hero').getBoundingClientRect();return [...document.querySelectorAll('.art-hero .art-btn')].every(e=>e.getBoundingClientRect().bottom<=h.bottom);}"""
                    ),
                )

            run("artist states", artist)

            def filters():
                open_page("artists", 320, 568)
                # Two incompatible tag axes make the empty state reproducible.
                page.evaluate("""()=>window.bmArtists.setData([
                    {id:'T1',title:'Test A',styleTags:['Style A'],usecaseTags:['Use A']},
                    {id:'T2',title:'Test B',styleTags:['Style B'],usecaseTags:['Use B']}
                ])""")
                page.get_by_role("button", name="Style A", exact=True).click()
                check(
                    engine + " artist filter narrows cards",
                    page.locator(".art-card").count() == 1,
                )
                page.get_by_role("button", name="Use B", exact=True).click()
                check(
                    engine + " artist empty state fits",
                    page.locator("#artEmpty").is_visible()
                    and page.locator("#artEmpty").evaluate(
                        "e=>e.getBoundingClientRect().right<=innerWidth"
                    ),
                )
                page.locator("#artReset").click()
                check(
                    engine + " artist filters reset",
                    page.locator(".art-card").count() == 2,
                )

            run("filters", filters)

            def forms():
                for width, height in [(320, 568), (390, 844), (820, 1180), (1180, 820)]:
                    open_page("contact", width, height)
                    before = len(posts)
                    page.locator("button[type=submit]").click()
                    check(
                        engine + f" form required fields {width}",
                        len(posts) == before
                        and page.locator("#bmContactForm").is_visible(),
                    )
                    for sel, value in [
                        ("#bmCompany", "表示確認用テスト会社"),
                        ("#bmName", "表示確認"),
                        ("#bmEmail", "responsive-test@example.invalid"),
                        ("#bmMessage", "通信を遮断した表示検証です。"),
                    ]:
                        page.locator(sel).fill(value)
                    page.locator("button[type=submit]").click()
                    page.wait_for_selector("#bmContactForm", state="hidden")
                    check(
                        engine + f" form sending state {width}",
                        any(sending_states[before:]),
                    )
                    thanks = page.get_by_text(
                        "お問い合わせありがとうございます。", exact=True
                    )
                    check(engine + f" mocked form success {width}", thanks.is_visible())
                    check(
                        engine + f" success text fits {width}",
                        thanks.evaluate(
                            "e=>e.getBoundingClientRect().right<=innerWidth+1"
                        ),
                    )
                    shot("form-success-" + str(width))
                post_status[0] = 500
                open_page("contact")
                for sel, value in [
                    ("#bmCompany", "表示確認"),
                    ("#bmName", "表示確認"),
                    ("#bmEmail", "responsive-test@example.invalid"),
                    ("#bmMessage", "模擬エラー応答"),
                ]:
                    page.locator(sel).fill(value)
                messages = []

                def dismiss(dialog):
                    messages.append(dialog.message)
                    dialog.dismiss()

                page.on("dialog", dismiss)
                page.locator("button[type=submit]").click()
                page.wait_for_timeout(1000)
                check(
                    engine + " mocked form failure recovers",
                    bool(messages) and page.locator("button[type=submit]").is_enabled(),
                )
                post_status[0] = 200

            run("form states", forms)

            def reader():
                for width, height in [(390, 844), (820, 1180), (1180, 820)]:
                    open_page("biz-library?manga=mama-saiyo", width, height)
                    page.wait_for_selector("#mangaModal.open")
                    page.locator("#modalManga img").last.scroll_into_view_if_needed()
                    page.wait_for_function(
                        "(()=>{const e=document.querySelector('#modalManga img:last-child');return e&&e.complete&&e.naturalWidth;})()"
                    )
                    page.locator("#mangaModal").evaluate(
                        "e=>e.scrollTop=e.scrollHeight"
                    )
                    page.wait_for_selector("#mangaCtaOverlay.visible")
                    page.wait_for_function(
                        "getComputedStyle(document.querySelector('#mangaCtaOverlay')).opacity === '1'"
                    )
                    check(
                        engine + f" live final CTA fits {width}",
                        page.locator("#mangaCtaOverlay").evaluate(
                            "e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}"
                        ),
                    )
                    shot("final-cta-" + str(width))
                open_page("biz-library?manga=gaudia")
                page.wait_for_selector("#mangaModal.mode-spread")
                check(
                    engine + " spread has no sidebar gutter",
                    page.locator("#mangaModal").evaluate(
                        "e=>parseFloat(getComputedStyle(e).paddingLeft)===0"
                    ),
                )
                page.locator("#viewToggle").click()
                page.wait_for_selector("#mangaModal.mode-vertical")
                check(
                    engine + " vertical sidebar retains gutter",
                    page.locator("#mangaModal").evaluate(
                        "e=>parseFloat(getComputedStyle(e).paddingLeft)===100"
                    ),
                )
                page.set_viewport_size(dict(width=768, height=1024))
                page.wait_for_timeout(300)
                check(
                    engine + " reader rotation removes gutter",
                    page.locator("#mangaModal").evaluate(
                        "e=>parseFloat(getComputedStyle(e).paddingLeft)===0"
                    ),
                )

            run("reader states", reader)

            def tables():
                open_page("column/training-manga-production-checklist", 320, 568)
                check(
                    engine + " wide tables remain locally scrollable",
                    page.locator(".bm-table-scroll").evaluate_all(
                        """es=>es.length>0&&es.some(e=>e.scrollWidth>e.clientWidth)&&es.every(e=>e.getBoundingClientRect().right<=innerWidth)"""
                    ),
                )
                check(
                    engine + " overflowing tables have keyboard access",
                    page.locator(".bm-table-scroll").evaluate_all(
                        "es=>es.every(e=>e.scrollWidth<=e.clientWidth+1||e.tabIndex===0)"
                    ),
                )
                fixture = dict(
                    id=999999,
                    title="表示確認用",
                    content="<table><tr>"
                    + "<th>比較する項目</th>" * 12
                    + "</tr><tr>"
                    + "<td>内容を省略しない</td>" * 12
                    + "</tr></table>",
                )
                ctx.route(
                    "**/columns/999999*",
                    lambda r: r.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps(fixture),
                    ),
                )
                open_page("column-detail?id=999999", 320, 568)
                page.wait_for_selector("#colContent .bm-table-scroll")
                check(
                    engine + " dynamic sanitized table retains all cells",
                    page.locator("#colContent td").count() == 12,
                )
                check(
                    engine + " dynamic table scrolls locally",
                    page.locator("#colContent .bm-table-scroll").evaluate(
                        "e=>e.scrollWidth>e.clientWidth&&e.getBoundingClientRect().right<=innerWidth"
                    ),
                )
                ctx.unroute("**/columns/999999*")

            run("tables", tables)

            def reflow():
                from test_responsive_layout import SCAN, violations

                for path in [
                    "pricing",
                    "artists",
                    "company-manga",
                    "use-cases",
                    "bizanime",
                ]:
                    # CSS viewport equivalent to a 1280x800 window at 200% zoom.
                    open_page(path, 640, 400)
                    page.evaluate(
                        "async()=>{for(const e of document.querySelectorAll('main section')){e.scrollIntoView({behavior:'instant'});await new Promise(r=>setTimeout(r,50));}}"
                    )
                    page.wait_for_timeout(2000)
                    result = page.evaluate(SCAN)
                    check(
                        engine + " 200 percent viewport reflow " + path,
                        not violations(result),
                        violations(result),
                    )
                open_page("index", 1180, 820)
                for width, height in [
                    (1180, 820),
                    (820, 1180),
                    (1024, 768),
                    (1025, 768),
                    (1180, 820),
                ]:
                    page.set_viewport_size(dict(width=width, height=height))
                    page.locator("#s3dSection").evaluate(
                        "e=>e.scrollIntoView({behavior:'instant'})"
                    )
                    page.wait_for_timeout(3000)
                    fits = page.locator(".s3d-screen").evaluate_all(
                        "es=>es.every(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;})"
                    )
                    check(engine + f" home rotation fits {width}", fits)

            run("reflow and rotation", reflow)
            browser.close()
    failed = sum(not r["ok"] for r in results)
    print(f"{len(results) - failed} PASS / {failed} FAIL", flush=True)
    return bool(failed)


if __name__ == "__main__":
    raise SystemExit(main())
