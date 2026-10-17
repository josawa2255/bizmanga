"""Offline regression tests for builder boundaries and existing output contracts."""
import contextlib
from contextlib import redirect_stderr, redirect_stdout
import copy
import datetime
from html.parser import HTMLParser
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

from bm_build import output_batch, remove_file, render_template, replace_block, safe_slug, script_json, write_text
import bm_content
from bm_content import make_slug
import bm_feed
import bm_indexnow
from bm_html import _Sanitizer, site_url
import bm_pricing

ROOT = Path(__file__).resolve().parents[1]


def module(filename):
    spec = importlib.util.spec_from_file_location(filename.replace('-', '_'), ROOT / 'tools' / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


# A fake gh for publish tests: it only logs its arguments (and the remote's main at call time).
FAKE_GH = r'''
import json, os, subprocess, sys
remote = os.environ.get('FAKE_GH_REMOTE')
tip = ''
if remote:
    tip = subprocess.run(['git', 'ls-remote', remote, 'refs/heads/main'],
                         capture_output=True, text=True).stdout.split('\t')[0]
with open(os.environ['GH_LOG'], 'a', encoding='utf-8') as log:
    log.write(json.dumps({'args': sys.argv[1:], 'remote_main': tip}) + '\n')
sys.exit(int(os.environ.get('FAKE_GH_EXIT', '0')))
'''


def git_test_env(folder):
    """Isolated git identity/config, and a fake gh first on PATH that only logs to folder/gh.log.
    No test may start a real workflow: the real gh is shadowed, and no token or gh config is passed on."""
    folder = Path(folder)
    bin_dir = folder / 'fake-bin'
    bin_dir.mkdir(exist_ok=True)
    gh = bin_dir / 'gh'
    gh.write_text(f'#!{sys.executable}\n' + FAKE_GH, encoding='utf-8')
    gh.chmod(0o755)
    env = dict(os.environ, GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull,
               GIT_AUTHOR_NAME='Test', GIT_AUTHOR_EMAIL='test@example.test',
               GIT_COMMITTER_NAME='Test', GIT_COMMITTER_EMAIL='test@example.test',
               GIT_TERMINAL_PROMPT='0', GIT_EDITOR='true',
               PATH=f'{bin_dir}{os.pathsep}{os.environ["PATH"]}', GH_LOG=str(folder / 'gh.log'),
               GH_CONFIG_DIR=str(bin_dir), GITHUB_REPOSITORY='owner/repo')
    # Under Actions (checks.yml), a publish test must not write the real step's outputs or see real tokens.
    for name in ('GITHUB_OUTPUT', 'GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GH_REPO',
                 'FAKE_GH_EXIT', 'FAKE_GH_REMOTE'):
        env.pop(name, None)
    return env


def gh_log(folder):
    log = Path(folder) / 'gh.log'
    return [json.loads(line) for line in log.read_text(encoding='utf-8').splitlines()] if log.exists() else []


def load_workflow(workflow):
    """A workflow file as Python data, read without PyYAML (CI runs these tests without pip).
    Covers what this repository's workflows use: mappings, '- ' lists, | and >- block scalars,
    [a, b] flow lists, quoted scalars and comment lines. Scalars stay strings ('0', 'true')."""
    lines = (ROOT / '.github/workflows' / workflow).read_text(encoding='utf-8').splitlines()
    index = 0

    def indent_of(line):
        return len(line) - len(line.lstrip(' '))

    def next_content():
        nonlocal index
        while index < len(lines) and (not lines[index].strip() or lines[index].lstrip().startswith('#')):
            index += 1
        return lines[index] if index < len(lines) else None

    def scalar(text):
        text = text.strip()
        if len(text) > 1 and text[0] == text[-1] == "'":
            return text[1:-1].replace("''", "'")
        if len(text) > 1 and text[0] == text[-1] == '"':
            return json.loads(text)
        if text.startswith('[') and text.endswith(']'):
            return [scalar(part) for part in text[1:-1].split(',') if part.strip()]
        return {} if text == '{}' else text

    def block_scalar(style, key_indent):
        nonlocal index
        body = []
        while index < len(lines) and (not lines[index].strip() or indent_of(lines[index]) > key_indent):
            body.append(lines[index])
            index += 1
        while body and not body[-1].strip():
            body.pop()
        width = min(indent_of(line) for line in body if line.strip())
        body = [line[width:] for line in body]
        text = ' '.join(body) if style.startswith('>') else '\n'.join(body)
        return text if style.endswith('-') else text + '\n'

    def value(rest, key_indent):
        rest = rest.strip()
        if rest in ('|', '|-', '>', '>-'):
            return block_scalar(rest, key_indent)
        if rest:
            return scalar(rest)
        following = next_content()
        if following is None or indent_of(following) <= key_indent:
            return None
        return parse(indent_of(following))

    def parse(indent):
        nonlocal index
        if next_content().lstrip().startswith('- '):
            items = []
            while (line := next_content()) is not None and indent_of(line) == indent \
                    and line.lstrip().startswith('- '):
                content = line.lstrip()[2:]
                if re.match(r'[\w.-]+:(?: |$)', content):
                    lines[index] = ' ' * (indent + 2) + content    # "- key: v" starts a mapping
                    items.append(parse(indent + 2))
                else:
                    index += 1
                    items.append(scalar(content))
            return items
        mapping = {}
        while (line := next_content()) is not None and indent_of(line) == indent \
                and not line.lstrip().startswith('- '):
            key, _, rest = line.strip().partition(':')
            index += 1
            mapping[key] = value(rest, indent)
        return mapping

    return parse(0)


def job_steps(workflow):
    jobs = load_workflow(workflow)['jobs']
    [job] = jobs.values()
    return job['steps']


def workflow_checkout_ref(workflow):
    checkout = next(s for s in job_steps(workflow) if str(s.get('uses', '')).startswith('actions/checkout@'))
    return (checkout.get('with') or {}).get('ref')


def step_condition(condition, outputs):
    """GitHub's if: for the forms used here: steps.<id>.outputs.<name> == / != '<value>', joined by &&."""
    result = True
    for part in condition.split(' && '):
        match = re.fullmatch(r"steps\.([\w-]+)\.outputs\.([\w-]+) (==|!=) '([^']*)'", part.strip())
        actual = outputs.get(match[1], {}).get(match[2], '')
        result = result and ((actual == match[4]) == (match[3] == '=='))
    return result


def step_env(env, outputs):
    """Resolve ${{ steps.<id>.outputs.<name> }} in a step's env (the only expressions these steps pass on)."""
    return {name: re.sub(r'\$\{\{ steps\.([\w-]+)\.outputs\.([\w-]+) \}\}',
                         lambda m: outputs.get(m[1], {}).get(m[2], ''), text) for name, text in env.items()}


def run_step_script(script, cwd, env):
    """Run a run: block the way GitHub runs bash steps (bash -e -o pipefail). Returns (result, outputs)."""
    import shutil
    folder = Path(tempfile.mkdtemp(prefix='bm-step-', dir=cwd.parent))
    try:
        (folder / 'step.sh').write_text(script, encoding='utf-8')
        (folder / 'output').write_text('', encoding='utf-8')
        result = subprocess.run([shutil.which('bash'), '--noprofile', '--norc', '-eo', 'pipefail',
                                 str(folder / 'step.sh')], cwd=cwd, capture_output=True, text=True,
                                env=dict(env, GITHUB_OUTPUT=str(folder / 'output')))
        outputs = dict(line.split('=', 1) for line in (folder / 'output').read_text(encoding='utf-8').splitlines())
        return result, outputs
    finally:
        shutil.rmtree(folder)


class BuildTests(unittest.TestCase):
    def test_literal_marker_substitution(self):
        block = 'START backslash \\q and \\1 END'
        self.assertEqual(replace_block('START old END', 'START', 'END', block), (block, True))
        for value in ('START missing', 'START a END START b END'):
            with self.assertRaises(ValueError):
                replace_block(value, 'START', 'END', block, required=True)

    def test_slug_is_one_component(self):
        for slug in ('../outside', 'a/b', r'a\b', 'CON', 'nul', '', 'with space'):
            with self.assertRaises(ValueError):
                safe_slug(slug)
        self.assertEqual(safe_slug('manga-123'), 'manga-123')
        with redirect_stdout(io.StringIO()), patch('sys.stderr', io.StringIO()) as warning:
            self.assertEqual(make_slug({'id': 7, 'slug': '../outside'}), 'column-7')
        self.assertIn('::warning::', warning.getvalue(), 'a changed public URL must not be silent')

    def test_fetch_json_retries_only_transient_failures(self):
        import urllib.error
        import bm_build

        class Response(io.BytesIO):
            headers = {}

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        def http_error(code):
            return urllib.error.HTTPError('https://example.test', code, 'error', {}, None)

        with patch.object(bm_build.time, 'sleep') as sleep:
            with patch.object(bm_build.urllib.request, 'urlopen',
                              side_effect=[http_error(502), TimeoutError(), Response(b'[1]')]) as opened:
                self.assertEqual(bm_build.fetch_json('https://example.test'), [1])
            self.assertEqual(opened.call_count, 3)
            # Every attempt asks past the nginx cache in front of WP.
            self.assertEqual({call.args[0].full_url for call in opened.call_args_list},
                             {'https://example.test?_cb=' + bm_build.RUN_TOKEN})
            self.assertEqual(sleep.call_count, 2)
            with patch.object(bm_build.urllib.request, 'urlopen', side_effect=http_error(404)) as opened:
                with self.assertRaises(urllib.error.HTTPError):
                    bm_build.fetch_json('https://example.test')
            self.assertEqual(opened.call_count, 1, 'a 404 is final')
            with patch.object(bm_build.urllib.request, 'urlopen', side_effect=http_error(503)) as opened:
                with self.assertRaises(urllib.error.HTTPError):
                    bm_build.fetch_json('https://example.test')
            self.assertEqual(opened.call_count, bm_build.FETCH_ATTEMPTS)

    def test_wp_requests_bypass_the_cache_but_keys_and_outputs_do_not_include_it(self):
        import bm_build
        token = bm_build.RUN_TOKEN
        cases = {
            'https://cms.example/v1/columns': 'https://cms.example/v1/columns?_cb=' + token,
            'https://cms.example/v1/columns?site=bizmanga&per_page=100':
                'https://cms.example/v1/columns?site=bizmanga&per_page=100&_cb=' + token,
            # build-lp-cases.py already adds its own daily _cb: replaced, never duplicated.
            'https://cms.example/v1/works?per_page=100&_cb=20261015':
                'https://cms.example/v1/works?per_page=100&_cb=' + token,
            'https://cms.example/v1/columns?per_page=100&page=2':
                'https://cms.example/v1/columns?per_page=100&page=2&_cb=' + token,
        }
        for url, busted in cases.items():
            with self.subTest(url=url):
                self.assertEqual(bm_build.cache_busted(url), busted)
                self.assertEqual(bm_build.without_cache_buster(busted), url.replace('&_cb=20261015', ''))
                self.assertEqual(bm_build.cache_busted(bm_build.cache_busted(url)), busted)
        self.assertRegex(token, r'^[0-9a-f]+$')
        self.assertEqual(bm_build.without_cache_buster('https://cms.example/v1/columns?_cb=1'),
                         'https://cms.example/v1/columns')
        self.assertEqual(bm_build.without_cache_buster('https://cms.example/v1/a?_cbx=1&x=_cb'),
                         'https://cms.example/v1/a?_cbx=1&x=_cb', 'only the _cb parameter is removed')

        # check-builds caches (and replays to the second build) by the URL without _cb.
        check = module('check-builds.py')
        calls = []
        cached, cache = check.caching(lambda url, **_: calls.append(url) or ([{'id': 1}], {}))
        first = cached('https://cms.example/v1/works?per_page=100&_cb=20261015')
        second = cached('https://cms.example/v1/works?per_page=100&_cb=20261016')
        self.assertEqual(first, second)
        self.assertEqual(len(calls), 1)
        self.assertEqual(list(cache), ['https://cms.example/v1/works?per_page=100'])

        # The query never reaches a generated file: builders write URLs from WP data, not request URLs.
        columns = module('build-columns.py')
        record = {'id': 1, 'slug': 'example', 'title_ja': 'T', 'date_ymd': '2026-10-01',
                  'thumbnail': 'https://cms.contentsx.jp/a.webp'}
        with patch.object(bm_build.urllib.request, 'urlopen', side_effect=AssertionError('no network')):
            outputs = [columns.build_detail_page(record, {'content': '<p>x</p>'},
                                                 columns.TEMPLATE_PATH.read_text(encoding='utf-8')),
                       columns.build_card(record), columns.build_featured(record)]
        for output in outputs:
            self.assertNotIn(bm_build.CACHE_BUST_PARAM + '=', output)

    def test_only_bizmanga_works_are_validated(self):
        from bm_build import bizmanga_works
        works = [
            {'id': 'shown', 'show_site': 'both'},
            {'id': 'ContentX.Only', 'show_site': 'contentsx'},
            {'id': 'ContentX.Only', 'show_site': 'contentsx'},
        ]
        self.assertEqual([w['id'] for w in bizmanga_works(works)], ['shown'])
        for bad in ([{'id': '../x', 'show_site': 'both'}],
                    [{'id': 'dup', 'show_site': 'both'}, {'id': 'dup', 'show_site': 'both'}],
                    [{'id': 'other', 'show_site': 'contentsx'}],
                    {'id': 'not-a-list'}):
            with self.assertRaises(ValueError):
                bizmanga_works(bad)

    def test_json_and_html_are_separate_contexts(self):
        value = 'quote " & newline\n</script>{{other}}'
        from html import escape
        template = '<h1>{{title}}</h1><script type="application/ld+json">{"name":"{{title}}"}</script>'
        result = render_template(template, {'{{title}}': escape(value), '{{other}}': 'wrong'})
        self.assertIn('<h1>' + escape(value) + '</h1>', result)
        payload = re.search(r'application/ld\+json">(.*?)</script>', result, re.S)[1]
        self.assertEqual(json.loads(payload)['name'], value)
        self.assertNotIn('</script>', script_json({'name': value}))

    def test_detail_templates_accept_real_json_strings(self):
        columns = module('build-columns.py')
        works = module('build-works.py')
        title = 'quoted " title\nsecond line & more </script>'
        outputs = [
            columns.build_detail_page(
                {'id': 1, 'slug': 'example', 'title_ja': title}, {'content': '<p>Body</p>'},
                columns.TEMPLATE_PATH.read_text(encoding='utf-8')),
            works.build_detail_page({'id': 'example', 'title_ja': title},
                                   works.TEMPLATE_PATH.read_text(encoding='utf-8')),
        ]
        for output in outputs:
            docs = [json.loads(m[1]) for m in re.finditer(
                r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', output, re.S)]
            self.assertTrue(any(d.get('headline', d.get('name')) == title for d in docs))

    def test_void_tags_do_not_swallow_following_content(self):
        for tag in ('meta charset="utf-8"', 'link href="x"', 'base href="x"', 'embed src="x"'):
            parser = _Sanitizer()
            parser.feed('<p>before</p><' + tag + '><p>after</p>')
            parser.close()
            self.assertEqual(''.join(parser.out), '<p>before</p><p>after</p>')
        parser = _Sanitizer()
        parser.feed('<script>bad()</script><p onclick="bad()">safe</p>')
        self.assertEqual(''.join(parser.out), '<p>safe</p>')

    def test_rich_html_url_policy(self):
        class Attributes(HTMLParser):
            def handle_starttag(self, tag, attrs):
                if tag == case['tag']:
                    self.value = dict(attrs).get(case['attribute'])

        cases = json.loads((ROOT / 'tools/fixtures/rich-html-urls.json').read_text(encoding='utf-8'))
        for case in cases:
            with self.subTest(html=case['html']):
                sanitizer = _Sanitizer()
                sanitizer.feed(case['html'])
                sanitizer.close()
                output = Attributes()
                output.feed(''.join(sanitizer.out))
                self.assertEqual(output.value, case['expected'])

    def test_rich_html_rejects_literal_c0_and_del_in_urls(self):
        for codepoint in (*range(32), 127):
            for url in (chr(codepoint) + 'javascript:window.injected=true',
                        'java' + chr(codepoint) + 'script:window.injected=true'):
                with self.subTest(url=repr(url)):
                    sanitizer = _Sanitizer()
                    sanitizer.feed('<a href="' + url + '">probe</a>')
                    self.assertNotIn('href=', ''.join(sanitizer.out))

    def test_build_exception_keeps_original_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            original = root / 'old.html'
            original.write_text('original', encoding='utf-8')
            with self.assertRaises(RuntimeError):
                with output_batch(root):
                    write_text(original, 'changed')
                    write_text(root / 'new.html', 'new')
                    remove_file(original)
                    raise RuntimeError('render failed')
            self.assertEqual(original.read_text(encoding='utf-8'), 'original')
            self.assertFalse((root / 'new.html').exists())

    def test_commit_rollback_and_unchanged_mtime(self):
        import bm_build
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            a, b = root / 'a.html', root / 'b.html'
            a.write_text('before', encoding='utf-8')
            before = a.stat().st_mtime_ns
            with output_batch(root):
                write_text(a, 'before')
            self.assertEqual(before, a.stat().st_mtime_ns)
            atomic = bm_build._atomic_bytes

            def fail_second(path, data):
                if path == b:
                    raise OSError('disk failure')
                atomic(path, data)

            with patch.object(bm_build, '_atomic_bytes', side_effect=fail_second):
                with self.assertRaises(OSError):
                    with output_batch(root):
                        write_text(a, 'after')
                        write_text(b, 'new')
            self.assertEqual(a.read_text(encoding='utf-8'), 'before')
            self.assertFalse(b.exists())

    def test_output_cannot_escape_root(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                with output_batch(directory):
                    write_text(Path(directory).parent / 'outside.html', 'bad')

    def test_rollback_attempts_every_file_and_preserves_all_errors(self):
        import bm_build
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            a, b, c, d, new = (root / name for name in ('a', 'b', 'c', 'd', 'new'))
            for path in (a, b, c, d):
                path.write_bytes(b'before')
            commit_error = OSError('publish failed')
            restore_errors = {b: OSError('b is locked'), c: OSError('c is locked')}
            atomic = bm_build._atomic_bytes

            def fail_commit_and_restores(path, data):
                if path == d:
                    raise commit_error
                if data == b'before' and path in restore_errors:
                    raise restore_errors[path]
                atomic(path, data)

            with patch.object(bm_build, '_atomic_bytes', side_effect=fail_commit_and_restores):
                with self.assertRaises(ExceptionGroup) as raised:
                    with output_batch(root):
                        for path in (a, new, b, c, d):
                            write_text(path, 'after')
            self.assertEqual(raised.exception.exceptions,
                             (commit_error, restore_errors[c], restore_errors[b]))
            for path, error in restore_errors.items():
                self.assertIn(str(path), '\n'.join(error.__notes__))
                self.assertEqual(path.read_bytes(), b'after')
            self.assertEqual(a.read_bytes(), b'before', 'restore continues past failures')
            self.assertEqual(d.read_bytes(), b'before')
            self.assertFalse(new.exists(), 'new outputs are still removed')
            # Even an incomplete rollback must release the batch context.
            with output_batch(root):
                write_text(a, 'next build')
            self.assertEqual(a.read_bytes(), b'next build')

    def test_partial_column_fetch_does_not_publish(self):
        columns = module('build-columns.py')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            with patch.object(columns, 'COLUMN_DIR', root), patch.object(
                columns, 'fetch_column_detail', side_effect=OSError('offline')
            ):
                with self.assertRaises(RuntimeError):
                    with output_batch(root):
                        columns.generate_details([{'id': 1, 'slug': 'example'}])
            self.assertEqual(list(root.glob('*.html')), [])

    def test_home_column_grid_is_static_latest_eight(self):
        columns = module('build-columns.py')
        records = [{'id': i, 'slug': f'col-{i}', 'title_ja': f'記事{i}', 'excerpt_ja': f'抜粋{i}',
                    'category': '社内', 'date': f'2026.10.{i:02d}',
                    'thumbnail': f'https://cms.contentsx.jp/wp-content/uploads/{i}.webp'} for i in range(1, 11)]
        records[0].update({'slug': '../outside', 'category': '',
                           'title_ja': '"><script>alert(1)</script>16,600円〜（5本セット時）',
                           'excerpt_ja': '人間7割×AI3割のハイブリッド制作 <b>&</b>',
                           'thumbnail': 'javascript:alert(1)'})
        records[1]['thumbnail'] = 'https://evil.example/x.webp'
        records[2]['thumbnail'] = 'https://evil.example\\@contentsx.jp/x.webp'
        records[3]['thumbnail'] = '/material/local.webp'
        page = ('<div id="bmColumnGrid">\n          ' + columns.HOME_GRID_START
                + '\n          <a class="bm-column-card" href="column">dummy</a>\n          '
                + columns.HOME_GRID_END + '\n        </div>\n')

        class Cards(HTMLParser):
            def __init__(self):
                super().__init__()
                self.cards, self.text = [], {}
                self.current = None

            def handle_starttag(self, tag, attrs):
                attrs = dict(attrs)
                if tag == 'a':
                    self.cards.append({'href': attrs['href']})
                elif tag == 'img':
                    self.cards[-1].update(src=attrs['src'], alt=attrs['alt'])
                elif attrs.get('class', '').startswith('bm-column-card-'):
                    self.current = attrs['class']

            def handle_data(self, data):
                if self.current and data.strip():
                    self.cards[-1][self.current] = data

            def handle_endtag(self, tag):
                self.current = None

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            index = root / 'index.html'
            index.write_text(page, encoding='utf-8')
            with patch.object(columns, 'ROOT', root), redirect_stdout(io.StringIO()), \
                    patch('sys.stderr', io.StringIO()):
                with output_batch(root):
                    columns.update_home_html(records)
                first = index.read_bytes()
                with output_batch(root):
                    columns.update_home_html(records)
                self.assertEqual(first, index.read_bytes(), 'same input must not change index.html')
            html_out = first.decode('utf-8')
            self.assertNotIn('dummy', html_out)
            self.assertNotIn('<script>', html_out)
            self.assertNotIn('javascript:', html_out)
            self.assertNotIn('evil.example', html_out)
            parser = Cards()
            parser.feed(html_out)
            cards = parser.cards
            self.assertEqual(len(cards), columns.HOME_COLUMN_LIMIT)
            self.assertEqual([c['bm-column-card-date'] for c in cards],
                             [r['date'] for r in records[:8]], 'WP order, first eight')
            for card in cards:
                self.assertTrue(card['href'].startswith('/column/'), card['href'])
            self.assertEqual(cards[0]['href'], '/column/column-1', 'same URL as the generated page')
            self.assertEqual(cards[4]['href'], '/column/col-5')
            self.assertEqual(cards[0]['bm-column-card-title'], '"><script>alert(1)</script>25,740円〜（税抜・原稿料別途）')
            self.assertEqual(cards[0]['alt'], cards[0]['bm-column-card-title'])
            self.assertEqual(cards[0]['bm-column-card-excerpt'], '独自の制作メソッド <b>&</b>')
            self.assertNotIn('bm-column-card-cat', cards[0], 'no badge without a category')
            self.assertEqual(cards[1]['bm-column-card-cat'], '社内')
            self.assertEqual([c['src'] for c in cards[:5]],
                             [columns.FALLBACK_THUMB] * 3 + ['/material/local.webp',
                                                              records[4]['thumbnail']])
            # Without the marker the build fails and index.html is left alone.
            index.write_text('<div id="bmColumnGrid"></div>\n', encoding='utf-8')
            with patch.object(columns, 'ROOT', root), redirect_stdout(io.StringIO()), \
                    patch('sys.stderr', io.StringIO()):
                with self.assertRaises(ValueError):
                    with output_batch(root):
                        columns.update_home_html(records)
            self.assertEqual(index.read_text(encoding='utf-8'), '<div id="bmColumnGrid"></div>\n')

    def test_real_home_page_has_one_column_marker_and_no_runtime_fetch(self):
        columns = module('build-columns.py')
        source = (ROOT / 'index.html').read_text(encoding='utf-8')
        self.assertEqual(source.count(columns.HOME_GRID_START), 1)
        self.assertEqual(source.count(columns.HOME_GRID_END), 1)
        self.assertLess(source.index('id="bmColumnGrid"'), source.index(columns.HOME_GRID_START))
        api = (ROOT / 'js/bm-wp-api.js').read_text(encoding='utf-8')
        self.assertNotIn("apiFetch('/columns", api, 'the home column cards are static (Issue #79)')
        workflow = (ROOT / '.github/workflows/build-columns.yml').read_text(encoding='utf-8')
        commit = re.search(r'commit-generated\.py\n((?: {10}[^\n]*\n?)+)', workflow)[1]
        self.assertIn('index.html', commit.split())

    def test_site_url_policy_shared_fixture_python(self):
        # tools/fixtures/site-urls.json: the same cases run against js/bm-sanitize.js (next test).
        for case in json.loads((ROOT / 'tools/fixtures/site-urls.json').read_text(encoding='utf-8')):
            with self.subTest(url=case['url']):
                self.assertEqual(site_url(case['url']), case['expected'])

    def test_site_url_policy_shared_fixture_browser_sanitizer(self):
        import shutil
        node = shutil.which('node')
        if not node:
            self.skipTest('node is required to run js/bm-sanitize.js (checks.yml sets it up)')
        fixture = ROOT / 'tools/fixtures/site-urls.json'
        script = ("const vm = require('vm'), fs = require('fs');"
                  "const context = {window: {}};"
                  "vm.createContext(context);"
                  "vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), context);"
                  "const cases = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));"
                  "process.stdout.write(JSON.stringify(cases.map(c => context.window.bmSanitize.url(c.url))));")
        result = subprocess.run([node, '-e', script, str(ROOT / 'js/bm-sanitize.js'), str(fixture)],
                                capture_output=True, text=True, check=True)
        cases = json.loads(fixture.read_text(encoding='utf-8'))
        for case, actual in zip(cases, json.loads(result.stdout), strict=True):
            with self.subTest(url=case['url']):
                self.assertEqual(actual, case['expected'])

    def test_column_list_fetch_follows_pages_and_rejects_incomplete_lists(self):
        api, all_sites = bm_content.COLUMNS_API, bm_content.COLUMNS_ALL_SITES_API
        full = bm_content.COLUMNS_PER_PAGE

        def records(start, count):
            return [{'id': i, 'slug': f'c-{i}'} for i in range(start, start + count)]

        def fetch(pages):
            calls = []

            def fetch_page(url, **_):
                calls.append(url)
                value = pages[url]
                if isinstance(value, Exception):
                    raise value
                return copy.deepcopy(value[0]), value[1]
            with patch.object(bm_content, 'fetch_page', side_effect=fetch_page):
                return bm_content.fetch_columns(), calls

        result, calls = fetch({api: (records(1, 44), None), all_sites: (records(1, 45), None)})
        self.assertEqual([c['id'] for c in result], list(range(1, 45)))
        self.assertEqual(calls, [api, all_sites], 'a short page is the last page')

        result, calls = fetch({api: (records(1, full), None), api + '&page=2': (records(101, 30), '130'),
                               all_sites: (records(1, full), None), all_sites + '&page=2': (records(101, 31), None)})
        self.assertEqual(len(result), full + 30)
        self.assertEqual(calls, [api, api + '&page=2', all_sites, all_sites + '&page=2'])

        result, _ = fetch({api: (records(1, full), None), api + '&page=2': ([], None),
                           all_sites: (records(1, 50), None)})
        self.assertEqual(len(result), full, 'exactly one full page, then an empty page')

        failures = {
            # The current WP plugin ignores &page=: page 2 repeats page 1, so the list may be cut off.
            'pagination ignored': {api: (records(1, full), None), api + '&page=2': (records(1, full), None)},
            # The plugin takes the newest per_page posts of all sites before filtering by site.
            'cut before the site filter': {api: (records(1, 98), None), all_sites: (records(1, full), None),
                                           all_sites + '&page=2': (records(1, full), None)},
            'total header disagrees': {api: (records(1, 44), '45'), all_sites: (records(1, 45), None)},
            'empty list': {api: ([], None), all_sites: (records(1, 1), None)},
            'duplicate id': {api: (records(1, 2) + records(1, 1), None), all_sites: (records(1, 3), None)},
        }
        for name, pages in failures.items():
            with self.subTest(name), self.assertRaises(ValueError):
                fetch(pages)
        with self.assertRaises(OSError):
            fetch({api: (records(1, full), None), api + '&page=2': OSError('offline')})

    def test_failed_column_list_publishes_nothing_and_removes_nothing(self):
        columns = module('build-columns.py')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'column').mkdir()
            stale = root / 'column/old-article.html'
            stale.write_text('published', encoding='utf-8')
            for name in ('column.html', 'index.html', 'sitemap.xml'):
                (root / name).write_bytes((ROOT / name).read_bytes())
            before = {p: p.read_bytes() for p in root.rglob('*') if p.is_file()}
            full = [{'id': i, 'slug': f'c-{i}'} for i in range(1, bm_content.COLUMNS_PER_PAGE + 1)]

            def fetch_page(url, **_):
                if url.endswith('&page=2'):
                    raise OSError('connection reset')
                return copy.deepcopy(full), None

            with patch.object(columns, 'ROOT', root), patch.object(columns, 'COLUMN_DIR', root / 'column'), \
                    patch.object(columns, 'write_browser_script'), \
                    patch.object(bm_content, 'fetch_page', side_effect=fetch_page), \
                    patch.object(columns, 'fetch_column_detail', side_effect=AssertionError('not reached')), \
                    redirect_stdout(io.StringIO()), patch('sys.stderr', io.StringIO()):
                with self.assertRaises(SystemExit):
                    columns.main()
            self.assertEqual({p: p.read_bytes() for p in root.rglob('*') if p.is_file()}, before)

    def test_column_page_featured_is_static_and_matches_first_card(self):
        columns = module('build-columns.py')
        records = [
            {'id': 1, 'slug': 'newest', 'category': '', 'date': '2026.10.14', '_readtime': 8,
             'title_ja': '人間7割×AI3割のハイブリッド制作で 16,600円〜（5本セット時）',
             'excerpt_ja': '「人間7割×AI3割」の体制。16,600円〜（5本セット時） <b>&</b>',
             'thumbnail': 'javascript:alert(1)'},
            {'id': 2, 'slug': 'second', 'category': '社内', 'date': '2026.10.10', '_readtime': 5,
             'title_ja': 'B', 'excerpt_ja': 'b', 'thumbnail': 'https://cms.contentsx.jp/2.webp'},
            {'id': 3, 'slug': 'third', 'category': '', 'date': '2026.10.09', 'title_ja': 'C', 'excerpt_ja': 'c',
             'thumbnail': 'https://evil.example/3.webp'},
            {'id': 4, 'slug': 'fourth', 'category': '社内', 'date': '2026.10.08', 'title_ja': 'D', 'excerpt_ja': 'd'},
            {'id': 5, 'slug': 'fifth', 'category': 'BtoB戦略', 'date': '2026.10.07', 'title_ja': 'E',
             'excerpt_ja': 'e', 'thumbnail': '/material/local.webp'},
        ]

        class Anchors(HTMLParser):
            def __init__(self):
                super().__init__()
                self.items, self.current = [], None

            def handle_starttag(self, tag, attrs):
                attrs = dict(attrs)
                if tag == 'a':
                    self.items.append(dict(attrs, text={}))
                elif tag == 'img':
                    self.items[-1].update(src=attrs['src'], alt=attrs['alt'])
                elif attrs.get('class'):
                    self.current = attrs['class']

            def handle_data(self, data):
                if self.current and data.strip():
                    self.items[-1]['text'][self.current] = data

            def handle_endtag(self, tag):
                self.current = None

        def block(source, start, end):
            parser = Anchors()
            parser.feed(source.split(start, 1)[1].split(end, 1)[0])
            return parser.items

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            page = root / 'column.html'
            page.write_bytes((ROOT / 'column.html').read_bytes())
            with patch.object(columns, 'ROOT', root), redirect_stdout(io.StringIO()):
                with output_batch(root):
                    columns.update_column_html(copy.deepcopy(records))
                first = page.read_bytes()
                with output_batch(root):
                    columns.update_column_html(copy.deepcopy(records))
            self.assertEqual(first, page.read_bytes(), 'same input must not change column.html')
            html_out = first.decode('utf-8')

            # The featured article is static HTML (shown without JavaScript), not hidden by default.
            section = re.search(r'<section class="bm-column-featured" id="bmColumnFeatured"[^>]*>', html_out)[0]
            self.assertNotIn('style=', section)
            self.assertNotIn('hidden', section)
            [featured] = block(html_out, columns.FEATURED_START, columns.FEATURED_END)
            cards = block(html_out, columns.GRID_START, columns.GRID_END)
            self.assertEqual(featured['href'], '/column/newest')
            self.assertEqual(featured['data-category'], 'その他', 'same filter name as the card and the chip')
            self.assertNotIn('bm-column-featured-cat', featured['text'], 'no badge without a category')
            self.assertEqual(featured['src'], columns.FALLBACK_THUMB, 'unsafe thumbnail is replaced')
            # PC (featured) and phone (first card) show the same normalized text.
            self.assertEqual(cards[0]['class'], 'bm-column-card bm-column-card--featured')
            self.assertEqual([c['href'] for c in cards if 'featured' in c['class']], ['/column/newest'])
            self.assertEqual(cards[0]['href'], featured['href'])
            self.assertEqual(cards[0]['src'], featured['src'])
            self.assertEqual(featured['text']['bm-column-featured-title'], cards[0]['text']['bm-column-card-title'])
            self.assertEqual(featured['alt'], featured['text']['bm-column-featured-title'])
            excerpt = featured['text']['bm-column-featured-excerpt']
            self.assertEqual(excerpt, cards[0]['text']['bm-column-card-excerpt'])
            self.assertEqual(excerpt, '独自の制作メソッド。25,740円〜（税抜・原稿料別途） <b>&</b>')
            self.assertNotIn('7割', html_out.split(columns.FEATURED_START, 1)[1].split(columns.GRID_END, 1)[0])
            # Every card carries data-category; the chips count exactly those names (その他 last).
            self.assertEqual([c['href'].rsplit('/', 1)[1] for c in cards],
                             ['newest', 'second', 'third', 'fourth', 'fifth'])
            self.assertEqual([c['src'] for c in cards],
                             [columns.FALLBACK_THUMB, 'https://cms.contentsx.jp/2.webp', columns.FALLBACK_THUMB,
                              columns.FALLBACK_THUMB, '/material/local.webp'])
            data = json.loads(re.search(r'<script type="application/json" id="bm-column-data">(.*?)</script>',
                                        html_out, re.S)[1])
            self.assertEqual(data, {'total': 5, 'categories': [
                {'name': '社内', 'count': 2}, {'name': 'BtoB戦略', 'count': 1}, {'name': 'その他', 'count': 2}]})
            counted = {}
            for card in cards:
                counted[card['data-category']] = counted.get(card['data-category'], 0) + 1
            self.assertEqual(counted, {c['name']: c['count'] for c in data['categories']})

            # Without the featured marker the build fails and column.html is left alone.
            broken = html_out.replace(columns.FEATURED_START, '')
            page.write_text(broken, encoding='utf-8')
            with patch.object(columns, 'ROOT', root), redirect_stdout(io.StringIO()):
                with self.assertRaises(ValueError), output_batch(root):
                    columns.update_column_html(copy.deepcopy(records))
            self.assertEqual(page.read_text(encoding='utf-8'), broken)

    def test_real_column_page_is_static_and_does_not_load_the_wp_client(self):
        columns = module('build-columns.py')
        source = (ROOT / 'column.html').read_text(encoding='utf-8')
        scripts = re.findall(r'<script[^>]*\bsrc="([^"]+)"', source)
        for name in ('bm-wp-api.js', 'bm-wp-config.js'):
            self.assertFalse([s for s in scripts if s.endswith(name)], f'column.html must not load {name} (#74)')
        for marker in (columns.FEATURED_START, columns.FEATURED_END, columns.GRID_START, columns.GRID_END):
            self.assertEqual(source.count(marker), 1, marker)
        self.assertLess(source.index('id="bmColumnFeatured"'), source.index(columns.FEATURED_START))
        filter_js = (ROOT / 'js/bm-column-filter.js').read_text(encoding='utf-8')
        self.assertNotIn('.bm-column-card-cat', filter_js, 'data-category is always written by the builder')
        self.assertNotIn('innerHTML', filter_js)

    def test_column_dates_agree_across_detail_sitemap_and_feed(self):
        from xml.etree import ElementTree
        columns = module('build-columns.py')
        jst_today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date().isoformat()
        records = [
            # Scheduled post: WP modified before publication.
            {'id': 1, 'slug': 'scheduled', 'date': '2026.10.14', 'date_ymd': '2026-10-14', 'modified_ymd': '2026-10-05'},
            {'id': 2, 'slug': 'edited', 'date': '2026.09.01', 'date_ymd': '2026-09-01', 'modified_ymd': '2026-10-05'},
            # Edited today: no clock-based exception (output depends on WP data only).
            {'id': 3, 'slug': 'edited-today', 'date_ymd': '2026-09-02', 'modified_ymd': jst_today},
            {'id': 4, 'slug': 'dotted-only', 'date': '2026.08.01'},
        ]
        expected = {'scheduled': '2026-10-14', 'edited': '2026-10-05', 'edited-today': jst_today,
                    'dotted-only': '2026-08-01'}
        self.assertEqual({r['slug']: bm_content.updated_ymd(r) for r in records}, expected)
        self.assertEqual(bm_content.updated_ymd({'date': 'unknown'}), '')

        template = columns.TEMPLATE_PATH.read_text(encoding='utf-8')
        for record in records:
            page = columns.build_detail_page(record, {'content': '<p>x</p>'}, template)
            article = next(d for d in (json.loads(m[1]) for m in re.finditer(
                r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', page, re.S))
                if 'dateModified' in d)
            self.assertEqual(article['dateModified'], expected[record['slug']], record['slug'])
            self.assertIn(f'<meta property="article:modified_time" content="{expected[record["slug"]]}T', page)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'sitemap.xml').write_text(
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>', encoding='utf-8')
            with patch.object(columns, 'ROOT', root), redirect_stdout(io.StringIO()):
                with output_batch(root):
                    columns.update_sitemap(records)
            ns = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
            lastmod = {u.findtext(ns + 'loc').rsplit('/', 1)[1]: u.findtext(ns + 'lastmod')
                       for u in ElementTree.parse(root / 'sitemap.xml').getroot()}
        self.assertEqual(lastmod, expected)
        for record in records:
            self.assertGreaterEqual(lastmod[record['slug']], bm_content.published_ymd(record))

        rss, _ = bm_feed.render_feed(records, [])
        channel = ElementTree.fromstring(rss).find('channel')
        self.assertEqual([i.findtext('link').rsplit('/', 1)[1] for i in channel.findall('item')],
                         sorted(expected, key=expected.get, reverse=True))
        # The newest article's day at 00:00 JST: never later than the build on that day.
        self.assertEqual(channel.findtext('lastBuildDate'), bm_feed.rfc822(max(expected.values()), hour=0))

    def test_detail_page_images_use_the_shared_url_check(self):
        columns = module('build-columns.py')
        template = columns.TEMPLATE_PATH.read_text(encoding='utf-8')
        cases = {
            'https://cms.contentsx.jp/wp-content/uploads/a.webp': 'https://cms.contentsx.jp/wp-content/uploads/a.webp',
            'https://evil.example/a.webp': columns.FALLBACK_THUMB,
            'javascript:alert(1)': columns.FALLBACK_THUMB,
            '': columns.FALLBACK_THUMB,
            # og:image and JSON-LD need an absolute URL.
            '/material/local.webp': columns.SITE + '/material/local.webp',
        }
        for thumbnail, image in cases.items():
            with self.subTest(thumbnail=thumbnail):
                page = columns.build_detail_page({'id': 1, 'slug': 'example', 'title_ja': 'T', 'thumbnail': thumbnail},
                                                 {'content': '<p>x</p>'}, template)
                self.assertIn(f'<meta property="og:image" content="{image}">', page)
                self.assertIn(f'<meta name="twitter:image" content="{image}">', page)
                self.assertIn(f'<figure class="bm-col-static-hero"><img src="{image}"', page)
                article = next(d for d in (json.loads(m[1]) for m in re.finditer(
                    r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', page, re.S))
                    if 'dateModified' in d)
                self.assertEqual(article['image']['url'], image)

    def test_all_eight_lps_are_v2(self):
        lp = module('build-lp-cases.py')
        self.assertEqual(len(lp.LP_CATEGORIES), 8)
        for slug in lp.LP_CATEGORIES:
            self.assertTrue(lp.is_v2_lp(slug), slug)

    def test_lp_rebuild_is_idempotent(self):
        lp = module('build-lp-cases.py')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            for name in lp.LP_CATEGORIES:
                path = root / (name + '.html')
                path.write_bytes((ROOT / path.name).read_bytes())
                section = lp.render_section(name, lp.LP_NAMES[name], [])
                with patch.object(lp, 'ROOT', root):
                    lp.patch_lp(name, section)
                    first = path.read_bytes()
                    self.assertFalse(lp.patch_lp(name, section))
                    self.assertEqual(first, path.read_bytes())

    def test_generated_pricing_matches_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'tools/templates').mkdir(parents=True)
            (root / 'js').mkdir()
            template = ROOT / 'tools/templates/bm-pricing.js.tpl'
            (root / 'tools/templates/bm-pricing.js.tpl').write_bytes(template.read_bytes())
            with patch.object(bm_pricing, 'ROOT', root):
                bm_pricing.write_browser_script()
            self.assertEqual((root / 'js/bm-pricing.js').read_text(encoding='utf-8'),
                             (ROOT / 'js/bm-pricing.js').read_text(encoding='utf-8'))

    def test_price_normalization_preserves_html_attributes(self):
        source = '<a href="/16,600円"><strong>1ページ</strong>16,600円〜</a>'
        result = bm_pricing.normalize_price_html(source)
        self.assertIn('href="/16,600円"', result)
        self.assertIn('25,740', result)
        self.assertEqual(result, bm_pricing.normalize_price_html(result))
        self.assertEqual(bm_pricing.normalize_price_text('116,600円'), '116,600円')

    def test_feed_uses_canonical_slug_and_valid_xml(self):
        from xml.etree import ElementTree
        with patch('sys.stderr', io.StringIO()):
            result = bm_feed.build_item({'id': 7, 'slug': '../outside', 'title_ja': 'A & B',
                                         'thumbnail': 'https://contentsx.jp/a?x=1&y="2"'}, 'column')
        item = ElementTree.fromstring(result)
        self.assertTrue(item.findtext('link').endswith('/column/column-7'))
        self.assertIsNone(item.find('pubDate'), 'no date is omitted, never filled with the clock')
        self.assertEqual(item.find('enclosure').get('url'), 'https://contentsx.jp/a?x=1&y="2"')
        self.assertNotRegex(result, r'\n[ \t]*\n', 'an omitted element leaves no blank line')

    def test_feed_text_links_and_categories_follow_the_site(self):
        from xml.etree import ElementTree
        noise = '\x00\x01\x08\x0b\x0c\x1f\ufffe\uffff'
        columns = [{'id': 1, 'slug': 'priced', 'date_ymd': '2026-10-14', 'category': 'BtoB' + noise,
                    'title_ja': noise + '人間7割×AI3割のハイブリッド制作 16,600円〜（5本セット時）',
                    'excerpt_ja': '「人間7割×AI3割」の体制' + noise + ' <b>&</b>',
                    'thumbnail': 'javascript:alert(1)'},
                   {'id': 2, 'slug': 'plain', 'date_ymd': '2026-10-01', 'category': '', 'excerpt_ja': '',
                    'title_ja': 'Plain', 'thumbnail': '/material/x.webp'}]
        news = [
            {'id': 11, 'date': '2026.10.13', 'title_ja': 'External' + noise, 'url': 'https://example.com/press?a=1&b=2',
             'has_detail': True, 'tag_ja': ''},
            {'id': 12, 'date': '2026.10.12', 'title_ja': 'Relative', 'url': '/works/x', 'tag_ja': 'お知らせ'},
            {'id': 13, 'date': '2026.10.11', 'title_ja': 'Unsafe', 'url': 'javascript:alert(1)', 'has_detail': True},
            {'id': 14, 'date': '2026.10.10', 'title_ja': 'No link', 'url': '', 'has_detail': False},
            {'id': '15 a', 'date': '2026.10.09', 'title_ja': 'Detail', 'has_detail': True},
            {'id': 16, 'date': '2026.10.08', 'title_ja': 'Protocol relative', 'url': '//evil.example/x'},
            {'id': 17, 'date': '2026.10.07', 'title_ja': 'Data', 'url': 'data:text/html,x', 'has_detail': True},
            {'id': 18, 'date': '2026.10.06', 'title_ja': '16,600円〜', 'url': 'http://contentsx.jp/a b'},
        ]
        rss, count = bm_feed.render_feed(columns, news)
        self.assertEqual(count, 10)
        channel = ElementTree.fromstring(rss).find('channel')     # control characters never break the XML
        site = bm_feed.SITE_URL
        self.assertEqual([i.findtext('guid') for i in channel.findall('item')], [
            f'{site}/column/priced', 'https://example.com/press?a=1&b=2', f'{site}/works/x',
            f'{site}/news-detail?id=13', f'{site}/news', f'{site}/news-detail?id=15%20a', f'{site}/news',
            f'{site}/news-detail?id=17', f'{site}/news', f'{site}/column/plain'])
        items = {i.findtext('guid'): i for i in channel.findall('item')}
        priced = items[f'{site}/column/priced']
        # Same normalization as the column pages (prices and brand wording); control characters removed.
        self.assertEqual(priced.findtext('title'), '独自の制作メソッド 25,740円〜（税抜・原稿料別途）')
        self.assertEqual(priced.findtext('description'), '独自の制作メソッド <b>&</b>')
        self.assertEqual(priced.findtext('category'), 'BtoB')
        self.assertIsNone(priced.find('enclosure'), 'the same URL check as the pages')
        plain = items[f'{site}/column/plain']
        self.assertEqual(plain.findtext('category'), 'コラム')
        self.assertEqual(plain.findtext('description'), bm_feed.EXCERPT_FALLBACK['column'])
        self.assertEqual(plain.find('enclosure').get('url'), f'{site}/material/x.webp')
        external = items['https://example.com/press?a=1&b=2']
        self.assertEqual(external.findtext('title'), 'External')
        self.assertEqual(external.findtext('category'), 'ニュース')
        self.assertEqual(external.findtext('description'), bm_feed.EXCERPT_FALLBACK['news'])
        self.assertEqual(items[f'{site}/works/x'].findtext('category'), 'お知らせ')
        self.assertEqual([i.findtext('title') for i in channel.findall('item')][-2], '16,600円〜',
                         'news text is shown as WP has it, like the news pages')
        self.assertNotIn('\x0b', rss)
        self.assertNotRegex(rss, r'\n[ \t]*\n')
        self.assertEqual(channel.findtext('lastBuildDate'), 'Wed, 14 Oct 2026 00:00:00 +0900')
        self.assertEqual(priced.findtext('pubDate'), 'Wed, 14 Oct 2026 09:00:00 +0900')
        self.assertEqual(bm_feed.render_feed(columns, news), (rss, count), 'same input, same output')
        # No readable date at all: no lastBuildDate (never the clock).
        empty, _ = bm_feed.render_feed([{'id': 3, 'slug': 'undated', 'title_ja': 'U'}], [])
        self.assertIsNone(ElementTree.fromstring(empty).find('channel/lastBuildDate'))

    def test_feed_output_does_not_depend_on_clock(self):
        from xml.etree import ElementTree
        feed = module('build-feed.py')
        columns_list = [
            {'id': 1, 'slug': 'older', 'title_ja': 'Older', 'date_ymd': '2026-09-01',
             'modified_ymd': '2026-10-05'},
            # WordPress can report a modified date before the publication date.
            {'id': 2, 'slug': 'newest', 'title_ja': 'Newest', 'date_ymd': '2026-10-14',
             'modified_ymd': '2026-10-05'},
        ]
        responses = {
            # The feed lists columns through the same function as the page builder (bm_content.fetch_columns).
            bm_content.COLUMNS_API: columns_list,
            bm_content.COLUMNS_ALL_SITES_API: columns_list,
            # News has only a dotted date.
            bm_feed.NEWS_API: [{'id': 9, 'date': '2026.10.12', 'title_ja': 'News', 'has_detail': True}],
        }

        class Clock(datetime.datetime):
            current = None

            @classmethod
            def now(cls, tz=None):
                return cls.current if tz is None else cls.current.astimezone(tz)

        class Day(datetime.date):
            @classmethod
            def today(cls):
                return Clock.current.date()

        clock = types.SimpleNamespace(datetime=Clock, date=Day, timezone=datetime.timezone,
                                      timedelta=datetime.timedelta)

        def build(root, now, data):
            Clock.current = now
            with patch.object(bm_feed, 'datetime', clock), patch.object(feed, 'ROOT', root), \
                    patch.object(bm_feed, 'fetch_json', side_effect=lambda url, **_: copy.deepcopy(data[url])), \
                    patch.object(bm_content, 'fetch_page',
                                 side_effect=lambda url, **_: (copy.deepcopy(data[url]), None)), \
                    redirect_stdout(io.StringIO()):
                feed.main()
            return (root / 'feed.xml').read_bytes()

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            jst = datetime.timezone(datetime.timedelta(hours=9))
            first = build(root, datetime.datetime(2026, 10, 14, 3, 0, 5, tzinfo=jst), responses)
            second = build(root, datetime.datetime(2027, 1, 1, 23, 59, 59, tzinfo=jst), responses)
            self.assertEqual(first, second, 'unchanged articles must give a byte-identical feed')
            channel = ElementTree.fromstring(first).find('channel')
            self.assertEqual(channel.findtext('lastBuildDate'), 'Wed, 14 Oct 2026 00:00:00 +0900',
                             'the newest article date (00:00 JST), not the build time')
            items = channel.findall('item')
            self.assertEqual([i.findtext('link').rsplit('/', 1)[1] for i in items],
                             ['newest', 'news-detail?id=9', 'older'])
            self.assertEqual(items[1].findtext('pubDate'), 'Mon, 12 Oct 2026 09:00:00 +0900')
            self.assertEqual(items[2].findtext('pubDate'), 'Tue, 01 Sep 2026 09:00:00 +0900')
            # No columns (an API failure) must not replace the published feed.
            with self.assertRaises(ValueError):
                build(root, Clock.current, dict(responses, **{bm_content.COLUMNS_API: []}))
            self.assertEqual((root / 'feed.xml').read_bytes(), first)

    def test_column_build_writes_the_feed_from_the_same_fetch(self):
        from xml.etree import ElementTree
        columns = module('build-columns.py')
        records = [{'id': i, 'slug': f'col-{i}', 'title_ja': f'記事{i}', 'excerpt_ja': f'抜粋{i}',
                    'category': '社内', 'date': f'2026.10.{i:02d}', 'date_ymd': f'2026-10-{i:02d}',
                    'thumbnail': f'https://cms.contentsx.jp/{i}.webp'} for i in (3, 2, 1)]
        pages = {bm_content.COLUMNS_API: records, bm_content.COLUMNS_ALL_SITES_API: records}

        def run(root, feed_patch=None):
            fetched, output = [], root / 'github-output'
            output.write_text('', encoding='utf-8')
            stderr = io.StringIO()

            def fetch_page(url, **_):
                fetched.append(url)
                return copy.deepcopy(pages[url]), None
            patches = [patch.object(columns, 'ROOT', root), patch.object(columns, 'COLUMN_DIR', root / 'column'),
                       patch.object(columns, 'write_browser_script'),
                       patch.object(bm_content, 'fetch_page', side_effect=fetch_page),
                       patch.object(columns, 'fetch_column_detail', return_value={'content': '<p>x</p>'}),
                       patch.object(bm_feed, 'fetch_json', return_value=[]),
                       patch.dict('os.environ', {'GITHUB_OUTPUT': str(output)}),
                       redirect_stdout(io.StringIO()), redirect_stderr(stderr)]
            if feed_patch:
                patches.append(feed_patch)
            with contextlib.ExitStack() as stack:
                for item in patches:
                    stack.enter_context(item)
                columns.main()
            return fetched, output.read_text(encoding='utf-8'), stderr.getvalue()

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            for name in ('column.html', 'index.html', 'sitemap.xml'):
                (root / name).write_bytes((ROOT / name).read_bytes())
            (root / 'column').mkdir()
            (root / 'feed.xml').write_text('<rss>old</rss>', encoding='utf-8')
            fetched, output, _ = run(root)
            # One fetch of the list (and its check of all sites) serves the pages and the feed.
            self.assertEqual(fetched, [bm_content.COLUMNS_API, bm_content.COLUMNS_ALL_SITES_API])
            self.assertEqual(output, 'feed=ok\n')
            links = [i.findtext('link') for i in ElementTree.parse(root / 'feed.xml').getroot().iter('item')]
            self.assertEqual(links, [f'{bm_feed.SITE_URL}/column/col-{i}' for i in (3, 2, 1)])
            self.assertEqual(sorted(p.name for p in (root / 'column').glob('*.html')),
                             ['col-1.html', 'col-2.html', 'col-3.html'])
            published = (root / 'feed.xml').read_bytes()

            # A failed feed keeps the column pages and the previous feed, and is reported (not raised).
            records.insert(0, dict(records[0], id=4, slug='col-4', date_ymd='2026-10-04'))
            for name, broken in (('render error', patch.object(bm_feed, 'render_feed', side_effect=RuntimeError('x'))),
                                 ('invalid XML', patch.object(bm_feed, 'render_feed', return_value=('<rss><x>', 1)))):
                with self.subTest(name):
                    _, output, stderr = run(root, broken)
                    self.assertEqual(output, 'feed=failed\n')
                    self.assertIn('::error::feed.xml was not updated', stderr)
                    self.assertTrue((root / 'column/col-4.html').is_file(), 'the column pages are published')
                    self.assertEqual((root / 'feed.xml').read_bytes(), published)

    def test_indexnow_sends_the_given_range_with_the_shared_key(self):
        indexnow = module('indexnow-ping.py')
        before, after = 'a' * 40, 'b' * 40
        with patch.dict('os.environ', {'INDEXNOW_BEFORE': before, 'INDEXNOW_AFTER': after}), \
                patch.object(indexnow.subprocess, 'check_output',
                             return_value='index.html\nworks/test.html\nsitemap.xml\njs/test.js\nnotes.txt\n') as git:
            self.assertEqual(indexnow.get_changed_urls(), [
                'https://bizmanga.contentsx.jp/', 'https://bizmanga.contentsx.jp/works/test',
                'https://bizmanga.contentsx.jp/sitemap.xml'])
            # Renames count as delete + add, so a URL that went away is sent too.
            self.assertEqual(git.call_args.args[0], ['git', 'diff', '--name-only', '--no-renames', before, after, '--'])
        # The whole site is never sent: no "all files" mode for a zero or missing commit.
        for bad in ({'INDEXNOW_BEFORE': '0' * 40, 'INDEXNOW_AFTER': after},
                    {'INDEXNOW_BEFORE': '', 'INDEXNOW_AFTER': after},
                    {'INDEXNOW_BEFORE': 'HEAD~1', 'INDEXNOW_AFTER': after}):
            with self.subTest(bad), patch.dict('os.environ', bad), \
                    patch.object(indexnow.subprocess, 'check_output') as git:
                with self.assertRaises(ValueError):
                    indexnow.get_changed_urls()
                git.assert_not_called()

        class Response:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        sent = []
        with patch.object(indexnow, 'get_changed_urls', return_value=['https://bizmanga.contentsx.jp/']), \
                patch.object(indexnow.urllib.request, 'urlopen',
                             side_effect=lambda request, timeout: sent.append(json.loads(request.data)) or Response()), \
                redirect_stdout(io.StringIO()):
            self.assertEqual(indexnow.main(), 0)
            # keyLocation is left out: IndexNow then reads https://{HOST}/{KEY}.txt, the file build-site-artifact makes.
            self.assertEqual(sent, [{'host': bm_indexnow.HOST, 'key': bm_indexnow.KEY,
                                     'urlList': ['https://bizmanga.contentsx.jp/']}])
            with patch.object(bm_indexnow, 'KEY', 'bad key'), redirect_stderr(io.StringIO()):
                self.assertEqual(indexnow.main(), 1, 'a key that is not published is not sent')
            self.assertEqual(len(sent), 1)

    def test_missing_artists_page_does_not_publish_data(self):
        artists = module('build-artists.py')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            data = root / 'artists-data.js'
            data.write_text('original', encoding='utf-8')
            with patch.object(artists, 'ROOT', root), patch.object(artists, 'DATA_PATH', data), \
                    patch.object(artists, 'HTML_PATH', root / 'missing.html'), \
                    patch.object(artists, 'fetch_artists', return_value=[{'title': 'Artist'}]):
                with self.assertRaises(FileNotFoundError):
                    artists.main()
            self.assertEqual(data.read_text(encoding='utf-8'), 'original')

    def test_xml_validation_prevents_publishing_invalid_feed(self):
        from xml.etree.ElementTree import ParseError
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'feed.xml'
            with self.assertRaises(ParseError):
                write_text(path, '<rss><unclosed></rss>')
            self.assertFalse(path.exists())


GENERATORS = ('build-works.yml', 'build-columns.yml', 'build-lp-cases.yml')  # rank-tracker.yml は不可侵領域のため対象外

# A fake gh serving the Pages and deployments API to the pages.yml steps, through the steps' real --jq filters.
FAKE_GH_API = r'''
import json, os, subprocess, sys
args = sys.argv[1:]
path = args[1]
data = json.load(open(os.environ['FAKE_GH'], encoding='utf-8'))
with open(os.environ['GH_LOG'], 'a', encoding='utf-8') as log:
    log.write(path + '\n')
route, _, query = path.partition('?')
deployments = data.get('deployments')
body = None
if args[0] == 'api' and route.endswith('/pages'):
    body = {'build_type': data['mode']}
elif route.endswith('/deployments') and deployments is not None and 'environment=github-pages' in query.split('&'):
    body = [{'id': d['id'], 'sha': d['sha'], 'environment': 'github-pages'} for d in deployments]
elif route.endswith('/statuses') and deployments is not None:
    match = [d for d in deployments if str(d['id']) == route.split('/')[-2]]
    if match and not match[0].get('fail'):
        body = [dict({'state': state}, **({} if url is False else {'environment_url': url}))
                for state, url in match[0]['statuses']]
if body is None:
    sys.exit(1)
query = args[args.index('--jq') + 1] if '--jq' in args else '.'
sys.exit(subprocess.run(['jq', '-r', query], input=json.dumps(body), text=True).returncode)
'''


class PublishTests(unittest.TestCase):
    """Exercise rebases against a local bare remote, never the project remote; gh is always a fake."""

    def test_generators_keep_pending_runs_and_checkout_latest_branch(self):
        for workflow in GENERATORS:
            with self.subTest(workflow=workflow):
                concurrency = load_workflow(workflow)['concurrency']
                self.assertEqual(concurrency, {'group': 'bizmanga-generated-content',
                                               'cancel-in-progress': 'false', 'queue': 'max'})
                self.assertEqual(workflow_checkout_ref(workflow), '${{ github.ref_name }}')

    def test_generators_start_the_deploy_and_send_nothing_to_indexnow(self):
        for workflow in GENERATORS:
            with self.subTest(workflow=workflow):
                data = load_workflow(workflow)
                # actions: write only for gh workflow run; nothing else is added.
                self.assertEqual(data['permissions'], {'contents': 'write', 'actions': 'write'})
                steps = job_steps(workflow)
                [commit] = [s for s in steps if 'tools/commit-generated.py' in (s.get('run') or '')]
                self.assertEqual(commit['env'], {'GH_TOKEN': '${{ github.token }}'})
                for step in steps:
                    if step is not commit:
                        self.assertNotIn('GH_TOKEN', step.get('env') or {})
                    self.assertNotIn('indexnow', json.dumps(step, ensure_ascii=False).lower(),
                                     'IndexNow is sent once, by pages.yml after the deploy')
                    self.assertNotIn('${{', step.get('run') or '', 'pass expressions through env, not into the shell')
        self.assertFalse((ROOT / '.github/workflows/indexnow.yml').exists())
        senders = sorted(p.name for p in (ROOT / '.github/workflows').glob('*.y*ml')
                         if 'indexnow-ping.py' in p.read_text(encoding='utf-8'))
        self.assertEqual(senders, ['pages.yml'])

    def test_column_build_runs_daily_and_reports_a_failed_feed_last(self):
        data = load_workflow('build-columns.yml')
        self.assertEqual(data['on'], {'schedule': [{'cron': '0 18 * * *'}], 'workflow_dispatch': None})
        steps = job_steps('build-columns.yml')
        build = next(i for i, s in enumerate(steps) if s.get('id') == 'columns')
        self.assertEqual(steps[build]['run'], 'python3 tools/build-columns.py')
        self.assertFalse([s for s in steps if 'build-feed.py' in (s.get('run') or '')],
                         'the feed is written by the column build from the same data')
        commit = next(i for i, s in enumerate(steps) if 'commit-generated.py' in (s.get('run') or ''))
        self.assertIn('feed.xml', steps[commit]['run'].split())
        self.assertLess(build, commit)
        # The failed feed fails the job last, after the push and the deploy start.
        self.assertEqual(commit, len(steps) - 2)
        self.assertEqual(steps[-1]['if'], "steps.columns.outputs.feed != 'ok'")
        self.assertIn('exit 1', steps[-1]['run'])

    def test_pages_deploys_the_tip_of_main_then_sends_indexnow(self):
        data = load_workflow('pages.yml')
        self.assertEqual(data['on'], {'push': {'branches': ['main']}, 'workflow_dispatch': None})
        self.assertEqual(data['permissions'], {'contents': 'read', 'pages': 'write', 'id-token': 'write',
                                               'deployments': 'read'})
        steps = job_steps('pages.yml')
        self.assertNotIn('github.sha', json.dumps(data), 'the checked-out HEAD is what is deployed and reported')
        position = {key: next(i for i, s in enumerate(steps) if test(s)) for key, test in {
            'mode': lambda s: s.get('id') == 'mode',
            'checkout': lambda s: str(s.get('uses', '')).startswith('actions/checkout@'),
            'range': lambda s: s.get('id') == 'range',
            'collect': lambda s: 'tools/build-site-artifact.py' in (s.get('run') or ''),
            'upload': lambda s: str(s.get('uses', '')).startswith('actions/upload-pages-artifact@'),
            'deploy': lambda s: s.get('id') == 'deployment',
            'ping': lambda s: 'indexnow-ping.py' in (s.get('run') or ''),
        }.items()}
        self.assertEqual(sorted(position, key=position.get),
                         ['mode', 'checkout', 'range', 'collect', 'upload', 'deploy', 'ping'])
        self.assertEqual(position['ping'], len(steps) - 1)
        # Always the tip of main (a re-run of an old run never publishes an old commit), with history for the diff.
        self.assertEqual(steps[position['checkout']]['with'], {'ref': 'main', 'fetch-depth': '0'})
        collect = steps[position['collect']]['run'].splitlines()
        self.assertLess(collect.index('python3 tools/check-site.py'),
                        collect.index('python3 tools/build-site-artifact.py'))
        for step in steps[1:]:
            self.assertTrue(step['if'].startswith("steps.mode.outputs.deploy == 'true'"), step.get('name'))
        for step in steps:
            self.assertNotIn('${{', step.get('run') or '', 'pass expressions through env, not into the shell')
        ping = steps[position['ping']]
        self.assertEqual(ping['if'], "steps.mode.outputs.deploy == 'true' && steps.range.outputs.before != ''")
        self.assertEqual(ping['continue-on-error'], 'true', 'a failed ping must not undo the deploy')
        self.assertEqual(ping['env'], {'INDEXNOW_BEFORE': '${{ steps.range.outputs.before }}',
                                       'INDEXNOW_AFTER': '${{ steps.range.outputs.after }}'})
        self.assertEqual(ping['run'], 'python3 tools/indexnow-ping.py')
        self.assertEqual(steps[position['range']]['env'], {'GH_TOKEN': '${{ github.token }}',
                                                           'REPO': '${{ github.repository }}'})

    def test_pages_runs_only_when_pages_deploys_from_actions_and_finds_the_last_deployment(self):
        import shutil
        if not shutil.which('bash') or not shutil.which('jq'):
            self.skipTest('bash and jq are required to run the workflow steps')
        steps = {s.get('id'): s for s in job_steps('pages.yml')}
        indexnow = module('indexnow-ping.py')
        with tempfile.TemporaryDirectory(prefix='bm-pages-steps-') as directory:
            folder = Path(directory).resolve()
            repo = folder / 'repo'
            env = git_test_env(folder)
            (folder / 'fake-bin/gh').write_text(f'#!{sys.executable}\n' + FAKE_GH_API, encoding='utf-8')

            def git(*args):
                return subprocess.check_output(['git', *args], cwd=repo, env=env, text=True).strip()

            repo.mkdir()
            git('init', '--initial-branch=main')
            for path, text in {'index.html': 'home', 'column/old.html': 'old article', 'sitemap.xml': '<urlset/>',
                               'tools/x.py': 'x = 1'}.items():
                (repo / path).parent.mkdir(exist_ok=True)
                (repo / path).write_text(text, encoding='utf-8')
            git('add', '.')
            git('commit', '-m', 'deployed before')
            deployed = git('rev-parse', 'HEAD')
            (repo / 'index.html').write_text('home 2', encoding='utf-8')
            git('mv', 'column/old.html', 'column/new.html')      # a slug change
            (repo / 'works').mkdir()
            (repo / 'works/a.html').write_text('work', encoding='utf-8')
            git('add', '.')
            git('commit', '-m', 'generated')
            skipped = git('rev-parse', 'HEAD')
            (repo / 'tools/x.py').write_text('x = 2', encoding='utf-8')
            (repo / 'notes.md').write_text('internal', encoding='utf-8')
            git('add', '.')
            git('commit', '-m', 'internal only')
            head = git('rev-parse', 'HEAD')
            site = f'https://{bm_indexnow.HOST}'
            expected_urls = [f'{site}/column/new', f'{site}/column/old', f'{site}/', f'{site}/works/a']

            def run(step, scenario):
                (folder / 'fake.json').write_text(json.dumps(scenario), encoding='utf-8')
                (folder / 'gh.log').write_text('', encoding='utf-8')
                result, outputs = run_step_script(
                    step['run'], repo, dict(env, FAKE_GH=str(folder / 'fake.json'), REPO='owner/repo'))
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                return outputs, (folder / 'gh.log').read_text(encoding='utf-8')

            for mode, deploy in (('workflow', 'true'), ('legacy', 'false')):
                with self.subTest(mode=mode):
                    outputs, calls = run(steps['mode'], {'mode': mode})
                    self.assertEqual(outputs, {'deploy': deploy})
                    self.assertEqual(calls, 'repos/owner/repo/pages\n', 'the deploy decision reads nothing else')

            def deployment(number, sha, *statuses, fail=False):  # statuses newest first, like the API
                return {'id': number, 'sha': sha, 'statuses': list(statuses), 'fail': fail}

            url = 'https://bizmanga.contentsx.jp/'
            own = deployment(9, head, ('in_progress', url), ('queued', False))   # this job, not finished
            cases = {
                'last success': ([own, deployment(2, deployed, ('success', url))], deployed),
                'older success, now inactive': (
                    [own, deployment(2, deployed, ('inactive', url), ('success', url), ('in_progress', url))], deployed),
                # A run that succeeded without deploying (Pages not on Actions) has no environment_url.
                'success without a deployment is skipped': (
                    [own, deployment(3, skipped, ('success', ''), ('in_progress', False)),
                     deployment(4, skipped, ('success', None)), deployment(2, deployed, ('success', url))], deployed),
                'failed deploys are skipped': (
                    [own, deployment(3, skipped, ('failure', url)), deployment(2, deployed, ('success', url))], deployed),
                'no deployments': ([], ''),
                'no success at all': ([own, deployment(3, skipped, ('failure', url))], ''),
                'deployments unreadable': (None, ''),
                'statuses unreadable: an older record is not used instead': (
                    [own, deployment(3, skipped, ('success', url), fail=True), deployment(2, deployed, ('success', url))], ''),
                'commit not in the checkout': ([deployment(2, 'f' * 40, ('success', url))], ''),
                'not a commit id': ([deployment(2, 'main', ('success', url))], ''),
            }

            def ping(outputs, failing=False):
                """The ping step as GitHub runs it after a successful deploy: its if:, its env, then the script."""
                step = next(s for s in job_steps('pages.yml') if 'indexnow-ping.py' in (s.get('run') or ''))
                if not step_condition(step['if'], outputs):
                    return None
                sent = []

                class Response:
                    status = 200

                    def __enter__(self):
                        return self

                    def __exit__(self, *args):
                        return False

                def urlopen(request, timeout):
                    if failing:
                        raise OSError('IndexNow is down')
                    sent.append(json.loads(request.data))
                    return Response()

                real = subprocess.check_output
                with patch.dict('os.environ', step_env(step['env'], outputs)), \
                        patch.object(indexnow.subprocess, 'check_output',
                                     side_effect=lambda command, **kw: real(command, cwd=repo, env=env, **kw)), \
                        patch.object(indexnow.urllib.request, 'urlopen', side_effect=urlopen), \
                        redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                    code = indexnow.main()
                return code, sent

            for name, (deployments, before) in cases.items():
                with self.subTest(name):
                    outputs, calls = run(steps['range'], {'mode': 'workflow', 'deployments': deployments})
                    self.assertEqual(outputs, {'after': head, 'before': before})
                    self.assertNotIn('repos/owner/repo/pages\n', calls)
                    result = ping({'mode': {'deploy': 'true'}, 'range': outputs})
                    if before:
                        # The changes since the last deployment, including the URL a slug change removed.
                        self.assertEqual(result, (0, [{'host': bm_indexnow.HOST, 'key': bm_indexnow.KEY,
                                                       'urlList': expected_urls}]))
                    else:
                        self.assertIsNone(result, 'no previous deployment: nothing is sent (never the whole site)')

            with self.subTest('a failed send is reported by the step only'):
                outputs, _ = run(steps['range'], {'mode': 'workflow', 'deployments': cases['last success'][0]})
                self.assertEqual(ping({'mode': {'deploy': 'true'}, 'range': outputs}, failing=True), (1, []))
            with self.subTest('Pages not on Actions: nothing after the mode step runs'):
                self.assertIsNone(ping({'mode': {'deploy': 'false'}, 'range': {'before': deployed, 'after': head}}))

    def test_push_starts_the_deploy_only_after_pushing_to_main(self):
        with tempfile.TemporaryDirectory(prefix='bm-deploy-start-') as directory:
            folder = Path(directory)
            remote, writer, human = (folder / name for name in ('remote.git', 'writer', 'human'))
            env = git_test_env(folder)
            deploy = ['workflow', 'run', 'pages.yml', '--ref', 'main', '--repo', 'owner/repo']

            def git(cwd, *args):
                return subprocess.check_output(['git', *args], cwd=cwd, env=env,
                                               stderr=subprocess.STDOUT, text=True).strip()

            def publish(cwd=writer, branch='main', **extra):
                (folder / 'gh.log').write_text('', encoding='utf-8')
                result = subprocess.run(
                    [sys.executable, '-B', str(ROOT / 'tools/commit-generated.py'),
                     '--message', 'generated', 'column/', 'sitemap.xml'], cwd=cwd,
                    env=dict(env, GITHUB_ACTIONS='true', GITHUB_REF_NAME=branch, FAKE_GH_REMOTE=str(remote), **extra),
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                )
                return result, gh_log(folder)

            def human_push(path, text):
                git(human, 'pull', '--ff-only')
                (human / path).parent.mkdir(exist_ok=True)
                (human / path).write_text(text, encoding='utf-8')
                git(human, 'add', path)
                git(human, 'commit', '-m', 'human edit')
                git(human, 'push')
                return git(human, 'rev-parse', 'HEAD')

            git(folder, 'init', '--bare', '--initial-branch=main', str(remote))
            git(folder, 'clone', str(remote), str(human))
            (human / 'column').mkdir()
            (human / 'column/old.html').write_text('old\n', encoding='utf-8')
            (human / 'sitemap.xml').write_text('<urlset/>\n', encoding='utf-8')
            git(human, 'add', '.')
            git(human, 'commit', '-m', 'initial')
            git(human, 'push', '-u', 'origin', 'main')
            # actions/checkout fetches a single commit.
            git(folder, 'clone', '--depth', '1', remote.as_uri(), str(writer))

            with self.subTest('changed while a human pushed: rebase, push, then start the deploy'):
                human_tip = human_push('about.html', 'human\n')
                (writer / 'column/new.html').write_text('new\n', encoding='utf-8')
                (writer / 'sitemap.xml').write_text('<urlset>new</urlset>\n', encoding='utf-8')
                result, calls = publish()
                self.assertEqual(result.returncode, 0, result.stdout)
                pushed = git(remote, 'rev-parse', 'main')
                self.assertEqual(git(remote, 'rev-parse', 'main~1'), human_tip)
                # Started once, after the push: the remote already had the generated commit.
                self.assertEqual(calls, [{'args': deploy, 'remote_main': pushed}])

            with self.subTest('no generated changes: nothing is started'):
                previous = git(remote, 'rev-parse', 'main')
                result, calls = publish()
                self.assertEqual(result.returncode, 0, result.stdout)
                self.assertEqual((calls, git(remote, 'rev-parse', 'main')), ([], previous))

            with self.subTest('the branch already has the same output: nothing is started'):
                human_tip = human_push('column/same.html', 'same\n')
                (writer / 'column/same.html').write_text('same\n', encoding='utf-8')
                result, calls = publish()
                self.assertEqual(result.returncode, 0, result.stdout)
                self.assertEqual((calls, git(remote, 'rev-parse', 'main')), ([], human_tip))

            with self.subTest('the deploy cannot be started: the job fails after the push'):
                (writer / 'column/old.html').write_text('updated\n', encoding='utf-8')
                result, calls = publish(FAKE_GH_EXIT='1')
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('were pushed to main', result.stdout)
                self.assertEqual(git(remote, 'show', 'main:column/old.html'), 'updated')
                self.assertEqual([c['args'] for c in calls], [deploy])

            with self.subTest('another branch is pushed but never deployed'):
                git(human, 'pull', '--ff-only')
                git(human, 'push', 'origin', 'HEAD:refs/heads/preview')
                other = folder / 'other'
                git(folder, 'clone', '--depth', '1', '--branch', 'preview', remote.as_uri(), str(other))
                (other / 'column/preview.html').write_text('preview\n', encoding='utf-8')
                result, calls = publish(other, branch='preview')
                self.assertEqual(result.returncode, 0, result.stdout)
                self.assertEqual(git(remote, 'show', 'preview:column/preview.html'), 'preview')
                self.assertEqual(calls, [])

    def test_queued_sitemap_generators_preserve_both_updates(self):
        from xml.etree import ElementTree
        builders = {'works': module('build-works.py'), 'columns': module('build-columns.py')}

        def render(kind, root, date):
            record = {'id': 'review-work' if kind == 'works' else 7,
                      'slug': 'review-column', 'modified_ymd': date}
            with patch.object(builders[kind], 'ROOT', root), redirect_stdout(io.StringIO()):
                with output_batch(root):
                    builders[kind].update_sitemap([record])

        # Both schedules can start at the same SHA. Test either queue order.
        for first, second in (('works', 'columns'), ('columns', 'works')):
            with self.subTest(first=first), tempfile.TemporaryDirectory(prefix='bm-queue-test-') as directory:
                folder = Path(directory)
                remote, writer, queued = (folder / name for name in ('remote.git', 'writer', 'queued'))
                env = git_test_env(folder)

                def git(cwd, *args):
                    return subprocess.check_output(['git', *args], cwd=cwd, env=env,
                                                   stderr=subprocess.STDOUT, text=True)

                def publish(cwd):
                    result = subprocess.run(
                        [sys.executable, '-B', str(ROOT / 'tools/commit-generated.py'),
                         '--message', 'generated sitemap', 'sitemap.xml'], cwd=cwd,
                        env=dict(env, GITHUB_ACTIONS='true', GITHUB_REF_NAME='main'),
                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                    )
                    self.assertEqual(result.returncode, 0, result.stdout)

                git(folder, 'init', '--bare', '--initial-branch=main', str(remote))
                git(folder, 'clone', str(remote), str(writer))
                (writer / 'sitemap.xml').write_text(
                    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>', encoding='utf-8')
                render('works', writer, '2026-01-01')
                render('columns', writer, '2026-01-01')
                git(writer, 'add', 'sitemap.xml')
                git(writer, 'commit', '-m', 'initial sitemap')
                git(writer, 'push', '-u', 'origin', 'main')
                git(folder, 'clone', str(remote), str(queued))
                event_sha = git(queued, 'rev-parse', 'HEAD').strip()
                render(first, writer, '2026-10-05')
                publish(writer)
                git(queued, 'fetch', 'origin', 'main')
                # Match checkout's explicit branch versus default event-SHA behavior.
                ref = workflow_checkout_ref(f'build-{second}.yml')
                git(queued, 'checkout', '--detach', 'origin/main' if ref == '${{ github.ref_name }}' else event_sha)
                self.assertEqual(git(queued, 'rev-parse', 'HEAD'), git(remote, 'rev-parse', 'main'))
                render(second, queued, '2026-10-06')
                publish(queued)
                xml = ElementTree.fromstring(git(remote, 'show', 'main:sitemap.xml'))
                ns = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
                dates = {entry.findtext(ns + 'loc'): entry.findtext(ns + 'lastmod') for entry in xml}
                urls = {'works': 'https://bizmanga.contentsx.jp/works/review-work',
                        'columns': 'https://bizmanga.contentsx.jp/column/review-column'}
                self.assertEqual(dates[urls[first]], '2026-10-05')
                self.assertEqual(dates[urls[second]], '2026-10-06')

    def test_rebase_preserves_independent_remote_change(self):
        self.exercise_push(conflict=False)

    def test_rebase_conflict_does_not_overwrite_remote(self):
        self.exercise_push(conflict=True)

    def exercise_push(self, *, conflict):
        with tempfile.TemporaryDirectory(prefix='bm-git-test-') as directory:
            folder = Path(directory)
            remote, writer, human = (folder / name for name in ('remote.git', 'writer', 'human'))
            env = git_test_env(folder)

            def git(cwd, *args):
                return subprocess.check_output(['git', *args], cwd=cwd, env=env,
                                               stderr=subprocess.STDOUT, text=True)

            git(folder, 'init', '--bare', '--initial-branch=main', str(remote))
            git(folder, 'clone', str(remote), str(writer))
            (writer / 'generated.txt').write_text('base\n', encoding='utf-8')
            git(writer, 'add', 'generated.txt')
            git(writer, 'commit', '-m', 'initial')
            git(writer, 'push', '-u', 'origin', 'main')
            git(folder, 'clone', str(remote), str(human))
            human_file = 'generated.txt' if conflict else 'human.txt'
            (human / human_file).write_text('human\n', encoding='utf-8')
            git(human, 'add', human_file)
            git(human, 'commit', '-m', 'human edit')
            git(human, 'push')
            (writer / 'generated.txt').write_text('generated\n', encoding='utf-8')
            result = subprocess.run(
                [sys.executable, '-B', str(ROOT / 'tools/commit-generated.py'),
                 '--message', 'generated output', 'generated.txt'], cwd=writer,
                env=dict(env, GITHUB_ACTIONS='true', GITHUB_REF_NAME='main'),
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            )
            self.assertEqual(result.returncode == 0, not conflict, result.stdout)
            self.assertEqual(git(remote, 'show', 'main:generated.txt').strip(),
                             'human' if conflict else 'generated')
            # The deploy is started only after a successful push.
            self.assertEqual(len(gh_log(folder)), 0 if conflict else 1)
            if not conflict:
                self.assertEqual(git(remote, 'show', 'main:human.txt').strip(), 'human')
                # Re-running without generated changes makes no extra commit.
                before = git(remote, 'rev-parse', 'main')
                again = subprocess.run(result.args, cwd=writer,
                                       env=dict(env, GITHUB_ACTIONS='true', GITHUB_REF_NAME='main'),
                                       capture_output=True, text=True)
                self.assertEqual(again.returncode, 0, again.stdout + again.stderr)
                self.assertEqual(git(remote, 'rev-parse', 'main'), before)
                self.assertEqual(len(gh_log(folder)), 1, 'nothing pushed, nothing started')


if __name__ == '__main__':
    unittest.main()
