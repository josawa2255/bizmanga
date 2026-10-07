#!/usr/bin/env python3
"""Browser regression checks with every external request mocked (no submissions)."""
from functools import partial
from http.server import ThreadingHTTPServer
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import threading
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from serve import CleanURLHandler


class QuietHandler(CleanURLHandler):
    def log_message(self, *_args):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass  # A browser navigation may cancel an image still being served.


def check_lp_cases(page):
    cases = page.locator('#chapter-04-cases')
    assert cases.count() == 1
    count = cases.locator('.lpv2-case').count()
    assert 0 <= count <= 3
    grid = cases.locator('.lpv2-cases-grid')
    if count:
        assert grid.count() == 1
        assert grid.evaluate('(e) => getComputedStyle(e).display') == 'grid'
    else:
        assert grid.count() == 0
        lead = cases.locator('.lpv2-lead')
        assert lead.count() == 1
        assert '該当ジャンルの事例は現在準備中です。' in lead.inner_text()
        expect(cases.locator('a[href="/works"]')).to_be_visible()
        expect(cases.locator('a[href="/biz-library"]')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    return cases


def fill_contact(page):
    values = {'#bmCompany': 'Test Company', '#bmDepartment': 'Sales',
              '#bmName': 'Test Name', '#bmEmail': 'test@example.test', '#bmMessage': 'Test message'}
    for selector, value in values.items():
        page.locator(selector).fill(value)
    return values


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--screenshots', type=Path)
    parser.add_argument('--browser', choices=('chromium', 'webkit'), default='chromium')
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}'
    submissions, failures, dialogs = [], [], []
    reply_status = 200
    content = '<h2>Test heading</h2><p>Safe body</p><img src="/favicon.ico" onerror="window.injected=true"><script>window.injected=true</script>'
    content += '<a id="url-probe" href="\x08javascript:window.injected=true">URL probe</a>'

    def route(request):
        nonlocal reply_status
        url = urlsplit(request.request.url)
        if url.hostname == 'api.hsforms.com':
            submissions.append(request.request.post_data_json)
            request.fulfill(status=reply_status, content_type='application/json', body='{}')
        elif request.request.resource_type == 'image' and url.hostname != '127.0.0.1':
            request.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300"><rect width="240" height="300" fill="#eee"/></svg>')
        elif url.hostname == 'cms.contentsx.jp':
            if '/columns/' in url.path or '/news/' in url.path:
                data = {'id': 1, 'slug': 'test', 'title_ja': 'Test article', 'content': content, 'date': '2026.01.01', 'date_ymd': '2026-01-01'}
            elif '/testimonials/' in url.path:
                data = {'id': 1, 'heading': 'Test testimonial', 'content': content}
            else:
                data = []
            request.fulfill(content_type='application/json', body=json.dumps(data), headers={'Access-Control-Allow-Origin': '*'})
        elif url.path.endswith('.pdf'):
            request.fulfill(content_type='application/pdf', body=b'%PDF-1.4\n%%EOF')
        elif url.hostname == '127.0.0.1':
            request.continue_()
        else:
            request.fulfill(status=200, content_type='text/javascript', body='')

    try:
        with sync_playwright() as playwright:
            browser = getattr(playwright, args.browser).launch()
            context = browser.new_context(service_workers='block')
            context.route('**/*', route)
            page = context.new_page()
            page.on('pageerror', lambda error: failures.append(str(error)))
            def dismiss_dialog(dialog):
                dialogs.append(dialog.message)
                dialog.dismiss()

            page.on('dialog', dismiss_dialog)
            page.add_init_script('window.BizcarteInbound = {sendForm: function() { window.crmCount = (window.crmCount || 0) + 1; }};')

            page.goto(base + '/contact?plan=hybrid', wait_until='domcontentloaded')
            expect(page.locator('#bmContactStatus')).to_be_hidden()
            expect(page.locator('#bmMessage')).to_have_value('【ハイブリッドプランについて】\n\n')
            fill_contact(page)
            reply_status = 500
            page.locator('#bmContactForm').evaluate('(f) => f.requestSubmit()')
            expect(page.locator('.bm-form-submit')).to_be_enabled()
            expect(page.locator('#bmContactForm')).to_be_visible()
            assert len(submissions) == 1
            assert not page.evaluate("(window.dataLayer || []).some(x => x[1] === 'generate_lead' || x[1] === 'conversion')")
            reply_status = 200
            page.locator('#bmContactForm').evaluate('(f) => { f.requestSubmit(); f.requestSubmit(); }')
            expect(page.locator('#bmContactForm')).to_be_hidden()
            assert len(submissions) == 2, 'double submission'
            assert page.evaluate('window.crmCount') == 2
            assert submissions[-1]['context']['pageName'] == 'BizManga - お問い合わせ'
            assert page.evaluate("window.dataLayer.filter(x => x[1] === 'generate_lead').length") == 1
            assert page.evaluate("window.dataLayer.filter(x => x[1] === 'conversion').length") == 1
            print('PASS contact: plan prefill, failure recovery, success-only conversion, duplicate guard, payload')

            for failure in ('http-error', 'missing-script', 'payload-error'):
                if failure == 'missing-script':
                    page.route('**/js/bm-lead.js', lambda request: request.abort())
                page.goto(base + '/download', wait_until='domcontentloaded')
                if failure == 'payload-error':
                    page.evaluate('() => { window.bmLead.payload = function() { throw new Error("payload failed"); }; }')
                for name, value in {'company': 'Test Company', 'department': 'Sales', 'name': 'Test Name', 'email': 'test@example.test'}.items():
                    page.locator(f'#download-form [name="{name}"]').fill(value)
                page.locator('[name="privacy_agree"]').check()
                reply_status = 500  # Download must remain available when HubSpot fails.
                with page.expect_download() as download:
                    page.locator('#download-form').evaluate('(f) => { f.requestSubmit(); f.requestSubmit(); }')
                assert download.value.suggested_filename == 'bizmanga-service-guide-202609.pdf'
                expect(page.locator('#dlThanks')).to_be_visible()
                page.wait_for_function('window.crmCount === 1')
                assert len(submissions) == 3
                assert submissions[-1]['context']['pageName'] == 'BizManga - 資料ダウンロード'
                if failure == 'missing-script':
                    page.unroute('**/js/bm-lead.js')
                print(f'PASS download: {failure} preserves PDF and CRM delivery; duplicate guard')

            # Without the form handler, neither the button nor implicit Enter may submit PII.
            page.route('**/js/bm-contact.js', lambda request: request.abort())
            page.goto(base + '/contact', wait_until='domcontentloaded')
            expect(page.locator('#bmContactForm')).to_have_attribute('method', 'post')
            expect(page.locator('.bm-form-submit')).to_be_disabled()
            expect(page.locator('#bmContactStatus')).to_be_visible()
            expect(page.locator('#bmContactStatus')).to_contain_text('再読み込み')
            expect(page.locator('#bmContactStatus a')).to_have_attribute('href', 'tel:03-6261-0764')
            values = fill_contact(page)
            before = len(submissions)
            page.locator('#bmEmail').press('Enter')
            expect(page).to_have_url(base + '/contact')
            assert len(submissions) == before
            assert page.evaluate('window.crmCount || 0') == 0
            for selector, value in values.items():
                expect(page.locator(selector)).to_have_value(value)
            page.unroute('**/js/bm-contact.js')
            if args.screenshots:
                page.locator('#bmContactForm').screenshot(path=str(args.screenshots / 'contact-handler-missing.png'))
            # A reload after the script becomes available must remove the fallback.
            page.reload(wait_until='domcontentloaded')
            expect(page.locator('#bmContactStatus')).to_be_hidden()
            expect(page.locator('.bm-form-submit')).to_be_enabled()
            print('PASS contact: missing handler shows recovery/phone guidance, keeps PII out of the URL; reload recovers')

            no_js = browser.new_context(java_script_enabled=False, service_workers='block')
            no_js.route('**/*', route)
            fallback = no_js.new_page()
            fallback.goto(base + '/contact', wait_until='domcontentloaded')
            expect(fallback.locator('#bmContactStatus')).to_be_visible()
            expect(fallback.locator('.bm-form-submit')).to_be_disabled()
            no_js.close()
            print('PASS contact: guidance is available with JavaScript disabled')

            for failure in ('missing-script', 'payload-error', 'send-error'):
                if failure == 'missing-script':
                    page.route('**/js/bm-lead.js', lambda request: request.abort())
                page.goto(base + '/contact', wait_until='domcontentloaded')
                expect(page.locator('.bm-form-submit')).to_be_enabled()
                if failure != 'missing-script':
                    method = 'payload' if failure == 'payload-error' else 'send'
                    page.evaluate('(method) => { window.bmLead[method] = function() { throw new Error("helper failed"); }; }', method)
                values = fill_contact(page)
                before, before_dialogs = len(submissions), len(dialogs)
                page.locator('#bmContactForm').evaluate('(f) => { f.requestSubmit(); f.requestSubmit(); }')
                expect(page.locator('.bm-form-submit')).to_be_enabled()
                expect(page.locator('#bmContactForm')).to_be_visible()
                assert not page.locator('.bm-form-submit').evaluate('(e) => e.classList.contains("is-sending")')
                assert len(dialogs) == before_dialogs + 1
                assert '送信結果を確認できませんでした' in dialogs[-1]
                assert len(submissions) == before
                assert page.evaluate('window.crmCount') == 1
                assert not page.evaluate("(window.dataLayer || []).some(x => x[1] === 'generate_lead' || x[1] === 'conversion')")
                expect(page).to_have_url(base + '/contact')
                for selector, value in values.items():
                    expect(page.locator(selector)).to_have_value(value)

                # A recovered helper must allow a subsequent submit with the retained input.
                if failure == 'missing-script':
                    page.unroute('**/js/bm-lead.js')
                page.add_script_tag(path=str(ROOT / 'js/bm-lead.js'))
                reply_status = 200
                page.locator('#bmContactForm').evaluate('(f) => { f.requestSubmit(); f.requestSubmit(); }')
                expect(page.locator('#bmContactForm')).to_be_hidden()
                assert len(submissions) == before + 1
                assert page.evaluate('window.crmCount') == 2
                assert page.evaluate("window.dataLayer.filter(x => x[1] === 'generate_lead').length") == 1
                assert page.evaluate("window.dataLayer.filter(x => x[1] === 'conversion').length") == 1
                print(f'PASS contact: {failure} reports failure, retains input, restores controls and allows recovery')

            page.route('**/js/bm-sanitize.js', lambda request: request.abort())
            for query in ('?id=1', ''):
                page.goto(base + '/testimonial-detail' + query, wait_until='domcontentloaded')
                expect(page.locator('#tmDetailError')).to_be_visible()
                expect(page.locator('#tmDetailLoading')).to_be_hidden()
                expect(page.locator('#tmDetailArticle')).to_be_hidden()
                expect(page.locator('#tmDetailContent')).to_be_empty()
                assert page.evaluate('window.injected !== true')
            page.unroute('**/js/bm-sanitize.js')
            print('PASS testimonial: missing sanitizer ends loading, shows error and never inserts raw content')

            for path, article, body in [('column-detail', '#colDetailArticle', '#colContent'),
                                       ('news-detail', '#newsDetailArticle', '#newsContent'),
                                       ('testimonial-detail', '#tmDetailArticle', '#tmDetailContent')]:
                page.goto(base + '/' + path + '?id=1', wait_until='domcontentloaded')
                expect(page.locator(article)).to_be_visible()
                expect(page.locator(body)).to_contain_text('Safe body')
                assert page.locator(body + ' script, ' + body + ' [onerror]').count() == 0
                assert page.evaluate('window.injected !== true')
                assert page.locator('#url-probe').get_attribute('href') is None
                page.locator('#url-probe').click()
                assert page.evaluate('window.injected !== true')
                print('PASS ' + path + ': external script initialization and sanitized API content')

            cases = json.loads((ROOT / 'tools/fixtures/rich-html-urls.json').read_text(encoding='utf-8'))
            for case in cases:
                actual = page.evaluate('''(c) => {
                    const root = document.createElement('div');
                    root.innerHTML = window.bmSanitize.rich(c.html);
                    return root.querySelector(c.tag).getAttribute(c.attribute);
                }''', case)
                assert actual == case['expected'], (case, actual)
            # Some controls become replacement characters during HTML parsing; their
            # remaining URLs must never resolve to an executable scheme either.
            assert page.evaluate('''() => {
                for (const code of [...Array(32).keys(), 127]) {
                    for (const url of [String.fromCharCode(code) + 'javascript:window.injected=true',
                                       'java' + String.fromCharCode(code) + 'script:window.injected=true']) {
                        const root = document.createElement('div');
                        root.innerHTML = window.bmSanitize.rich('<a href="' + url + '">probe</a>');
                        if (root.firstChild.protocol === 'javascript:') return false;
                    }
                }
                return true;
            }''')
            print(f'PASS rich HTML: {len(cases)} shared URL fixtures and all C0/DEL prefixes/infixes')

            # Render through the actual Python builder, then interpret and click in
            # the browser, covering the static path as well as dynamic API pages.
            spec = importlib.util.spec_from_file_location('columns', ROOT / 'tools/build-columns.py')
            columns = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(columns)
            rendered = columns.build_detail_page(
                {'id': 999999, 'slug': 'url-probe', 'title_ja': 'Local test'}, {'content': content},
                columns.TEMPLATE_PATH.read_text(encoding='utf-8'))
            page.route('**/column/url-probe', lambda request: request.fulfill(content_type='text/html', body=rendered))
            page.goto(base + '/column/url-probe', wait_until='domcontentloaded')
            assert page.locator('#url-probe').get_attribute('href') is None
            page.locator('#url-probe').click()
            assert page.evaluate('window.injected !== true')
            print('PASS static column: builder removes the executable URL before browser rendering')

            # The canonical template and checked-in pages must load their shared CSS.
            spec = importlib.util.spec_from_file_location('lp_cases', ROOT / 'tools/build-lp-cases.py')
            lp = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(lp)
            for width in (390, 1280):
                page.set_viewport_size({'width': width, 'height': 900})
                page.goto(base + '/column/what-is-business-manga', wait_until='domcontentloaded')
                assert page.locator('.bm-col-static').evaluate('(e) => getComputedStyle(e).paddingTop') == '140px'
                page.goto(base + '/privacy-policy', wait_until='domcontentloaded')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                for slug in ('product-manga', 'recruit-manga', 'manga-ad-lp', 'company-manga', 'sales-manga', 'training-manga', 'inbound-manga', 'ir-manga'):
                    page.goto(base + '/' + slug, wait_until='domcontentloaded')
                    cases = check_lp_cases(page)
                    if args.screenshots and slug == 'product-manga':
                        cases.screenshot(path=str(args.screenshots / f'lp-cases-{width}.png'))
                # Exercise the builder's supported zero-case state using its real markup.
                empty = lp.render_section('ir-manga', lp.LP_NAMES['ir-manga'], [])
                cases.evaluate('(e, html) => { e.outerHTML = html; }', empty)
                cases = check_lp_cases(page)
                # An accidentally blank section must still fail validation.
                cases.locator('.lpv2-lead').evaluate('(e) => { e.textContent = ""; }')
                try:
                    check_lp_cases(page)
                except AssertionError:
                    pass
                else:
                    raise AssertionError('Blank case sections must not pass as a valid empty state')
                print(f'PASS LP empty state at {width}px; blank sections are rejected')
            assert not failures, failures
            print('PASS shared column/privacy styles and all 8 v2 LPs at 390px and 1280px; no page errors')
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
