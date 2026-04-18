"""
BizManga モバイルヘッダー回帰テスト

目的: ハンバーガーメニューが「押せない」「開かない」「閉じない」系の再発を防ぐ。
参照: ~/.claude/skills/webapp-testing/SKILL.md

実行:
    PYTHONUNBUFFERED=1 python3 ~/.claude/skills/webapp-testing/scripts/with_server.py \\
        --server "python3 serve.py" --port 8000 \\
        -- python3 tools/test_mobile_nav.py

前提: cwd は BizManga/ 直下。serve.py が http://localhost:8000 で起動する。
index.html は Hero の大量画像で networkidle が来ないため domcontentloaded + 固定待ちで対応。

テスト対象ページ:
    / (index), /works, /pricing, /biz-library, /faq, /contact
"""
from __future__ import annotations

import functools
import sys
from dataclasses import dataclass
from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout

# 全 print を即フラッシュ（with_server.py 経由でも出力が見えるように）
print = functools.partial(print, flush=True)  # type: ignore[assignment]

BASE = "http://localhost:8000"
TARGET_PAGES = ["/", "/works", "/pricing", "/biz-library", "/faq", "/contact"]
MOBILE_VIEWPORT = {"width": 375, "height": 667}      # iPhone SE 相当
DESKTOP_VIEWPORT = {"width": 1280, "height": 800}


@dataclass
class Result:
    page: str
    name: str
    ok: bool
    detail: str = ""


results: list[Result] = []


def record(page_path: str, name: str, ok: bool, detail: str = "") -> None:
    results.append(Result(page_path, name, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {name}{' — ' + detail if detail else ''}")


def open_and_wait(page: Page, path: str) -> None:
    # index の Hero は画像ストリーミングで networkidle が来ないので
    # domcontentloaded + 対象要素の attached 待ちで確定させる
    page.goto(BASE + path, wait_until="domcontentloaded", timeout=10000)
    page.wait_for_selector("#bmHamburger", state="attached", timeout=5000)
    # bm-nav.js(defer) の実行完了 = .bm-lang-switch が挿入されるまで待つ
    page.wait_for_selector(".bm-lang-switch", state="attached", timeout=5000)


def check_mobile(page: Page, path: str) -> None:
    print(f"\n[MOBILE] {path}")
    page.set_viewport_size(MOBILE_VIEWPORT)
    open_and_wait(page, path)

    hamburger = page.locator("#bmHamburger")
    nav = page.locator("#bmNav")

    record(path, "hamburger visible on mobile", hamburger.is_visible())

    # クリックが他要素にインターセプトされないか（ヘッダー再発ポイント）
    try:
        hamburger.click(timeout=3000)
        record(path, "hamburger clickable (not intercepted)", True)
    except Exception as e:
        record(path, "hamburger clickable (not intercepted)", False, str(e)[:120])
        return

    # open 状態の検証
    try:
        page.wait_for_function(
            "() => document.getElementById('bmNav').classList.contains('open')",
            timeout=2000,
        )
        record(path, "nav gets .open on click", True)
    except PWTimeout:
        record(path, "nav gets .open on click", False)

    aria = hamburger.get_attribute("aria-expanded")
    record(path, 'aria-expanded="true" after open', aria == "true", f"actual={aria}")

    body_locked = page.evaluate(
        "() => document.body.classList.contains('bm-nav-locked')"
    )
    record(path, "body gets .bm-nav-locked (scroll lock)", body_locked)

    # 再クリックで閉じる
    hamburger.click()
    try:
        page.wait_for_function(
            "() => !document.getElementById('bmNav').classList.contains('open')",
            timeout=2000,
        )
        record(path, "second click closes nav", True)
    except PWTimeout:
        record(path, "second click closes nav", False)

    # ESC で閉じる
    hamburger.click()
    page.wait_for_function(
        "() => document.getElementById('bmNav').classList.contains('open')",
        timeout=2000,
    )
    page.keyboard.press("Escape")
    try:
        page.wait_for_function(
            "() => !document.getElementById('bmNav').classList.contains('open')",
            timeout=2000,
        )
        record(path, "ESC closes nav", True)
    except PWTimeout:
        record(path, "ESC closes nav", False)


def check_desktop(page: Page, path: str) -> None:
    print(f"\n[DESKTOP] {path}")
    page.set_viewport_size(DESKTOP_VIEWPORT)
    open_and_wait(page, path)
    hamburger = page.locator("#bmHamburger")
    # CSSで display:none になっているはず
    record(path, "hamburger hidden on desktop", not hamburger.is_visible())


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()

        for path in TARGET_PAGES:
            try:
                check_mobile(page, path)
            except Exception as e:
                record(path, "mobile run crashed", False, str(e)[:160])
            try:
                check_desktop(page, path)
            except Exception as e:
                record(path, "desktop run crashed", False, str(e)[:160])

        browser.close()

    # サマリ
    passed = sum(1 for r in results if r.ok)
    failed = [r for r in results if not r.ok]
    print("\n" + "=" * 60)
    print(f"Summary: {passed}/{len(results)} passed")
    if failed:
        print("\nFailures:")
        for r in failed:
            print(f"  - [{r.page}] {r.name}: {r.detail}")
        return 1
    print("All green.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
