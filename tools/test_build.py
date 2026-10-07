"""Offline regression tests for builder boundaries and existing output contracts."""
from contextlib import redirect_stdout
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
import unittest
from unittest.mock import patch

from bm_build import output_batch, remove_file, render_template, replace_block, safe_slug, script_json, write_text
from bm_content import make_slug
from bm_html import _Sanitizer
import bm_pricing

ROOT = Path(__file__).resolve().parents[1]


def module(filename):
    spec = importlib.util.spec_from_file_location(filename.replace('-', '_'), ROOT / 'tools' / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def git_test_env():
    # Isolate test identities, config and signing from the user's setup.
    return dict(os.environ, GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull,
                GIT_AUTHOR_NAME='Test', GIT_AUTHOR_EMAIL='test@example.test',
                GIT_COMMITTER_NAME='Test', GIT_COMMITTER_EMAIL='test@example.test',
                GIT_TERMINAL_PROMPT='0', GIT_EDITOR='true')


def workflow_checkout_ref(workflow):
    source = (ROOT / '.github/workflows' / workflow).read_text(encoding='utf-8')
    checkout = re.search(r'uses: actions/checkout@[^\n]+\n((?: {8,}[^\n]*\n)*)', source)
    ref = re.search(r'^\s+ref: (.+)$', checkout[1], re.M)
    return ref[1].strip() if ref else None


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
            self.assertEqual(sleep.call_count, 2)
            with patch.object(bm_build.urllib.request, 'urlopen', side_effect=http_error(404)) as opened:
                with self.assertRaises(urllib.error.HTTPError):
                    bm_build.fetch_json('https://example.test')
            self.assertEqual(opened.call_count, 1, 'a 404 is final')
            with patch.object(bm_build.urllib.request, 'urlopen', side_effect=http_error(503)) as opened:
                with self.assertRaises(urllib.error.HTTPError):
                    bm_build.fetch_json('https://example.test')
            self.assertEqual(opened.call_count, bm_build.FETCH_ATTEMPTS)

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
        feed = module('build-feed.py')
        result = feed.build_item({'id': 7, 'slug': '../outside', 'title_ja': 'A & B',
                                  'thumbnail': 'https://contentsx.jp/a?x=1&y="2"'}, 'column')
        item = ElementTree.fromstring(result)
        self.assertTrue(item.findtext('link').endswith('/column/column-7'))

    def test_indexnow_covers_entire_push_and_initial_push(self):
        indexnow = module('indexnow-ping.py')
        before, after = 'a' * 40, 'b' * 40
        with patch.dict('os.environ', {'INDEXNOW_BEFORE': before, 'INDEXNOW_AFTER': after}), \
                patch.object(indexnow.subprocess, 'check_output', return_value='index.html\nworks/test.html\nsitemap.xml\njs/test.js\n') as git:
            self.assertEqual(indexnow.get_changed_urls(), [
                'https://bizmanga.contentsx.jp/', 'https://bizmanga.contentsx.jp/works/test',
                'https://bizmanga.contentsx.jp/sitemap.xml'])
            self.assertEqual(git.call_args.args[0][-3:], [before, after, '--'])
        with patch.dict('os.environ', {'INDEXNOW_BEFORE': '0' * 40, 'INDEXNOW_AFTER': after}), \
                patch.object(indexnow.subprocess, 'check_output', return_value='index.html\n') as git:
            indexnow.get_changed_urls()
            self.assertEqual(git.call_args.args[0][1], 'ls-tree')

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


class PublishTests(unittest.TestCase):
    """Exercise rebases against a local bare remote, never the project remote."""

    def test_generators_keep_pending_runs_and_checkout_latest_branch(self):
        for workflow in ('build-works.yml', 'build-columns.yml', 'build-lp-cases.yml'):  # rank-tracker.yml は不可侵領域のため対象外
            with self.subTest(workflow=workflow):
                source = (ROOT / '.github/workflows' / workflow).read_text(encoding='utf-8')
                concurrency = re.search(r'^concurrency:\n((?: {2}[^\n]+\n)+)', source, re.M)[1]
                self.assertIn('  group: bizmanga-generated-content\n', concurrency)
                self.assertIn('  cancel-in-progress: false\n', concurrency)
                self.assertIn('  queue: max\n', concurrency)
                self.assertEqual(workflow_checkout_ref(workflow), '${{ github.ref_name }}')

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
                env = git_test_env()

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
            env = git_test_env()

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
            if not conflict:
                self.assertEqual(git(remote, 'show', 'main:human.txt').strip(), 'human')
                # Re-running without generated changes makes no extra commit.
                before = git(remote, 'rev-parse', 'main')
                again = subprocess.run(result.args, cwd=writer,
                                       env=dict(env, GITHUB_ACTIONS='true', GITHUB_REF_NAME='main'),
                                       capture_output=True, text=True)
                self.assertEqual(again.returncode, 0, again.stdout + again.stderr)
                self.assertEqual(git(remote, 'rev-parse', 'main'), before)


if __name__ == '__main__':
    unittest.main()
