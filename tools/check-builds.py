#!/usr/bin/env python3
"""Validate the static builders in a temporary copy; never publish.

By default the live WP API is read. To prove that a refactor keeps the generated files
byte-identical, record the API once and build both versions from the same responses
(the *.tmp names are git-ignored; record and replay on the same day, because a few outputs
fall back to today's date):

    python -B tools/check-builds.py --record wp-responses.tmp --out before.tmp
    (change the builders)
    python -B tools/check-builds.py --replay wp-responses.tmp --out after.tmp
    python -B tools/check-builds.py --compare before.tmp after.tmp

--out only ever replaces a folder that an earlier --out created.
"""

import argparse
import copy
import hashlib
import io
import json
import re
import shutil
import sys
import tempfile
from contextlib import redirect_stdout
from pathlib import Path

import bm_build
import bm_pricing
from bm_test_support import load_tool as load

ROOT = Path(__file__).resolve().parents[1]
INPUTS = (
    '*.html',
    '*.xml',
    'column/*.html',
    'works/**/*.html',
    'tools/templates/*',
    'js/artists-data.js',
    'js/bm-pricing.js',
    'material/images/og/works/*',
)
BUILDERS = ('build-works', 'build-columns', 'build-artists', 'build-feed', 'build-lp-cases')
OUT_MARKER = '.check-builds-out'
# build-lp-cases adds a daily cache buster (_cb=YYYYMMDD); recordings ignore it.
CACHE_BUSTER = re.compile(r'([?&])_cb=\d+(&|$)')


def relocate(module, target):
    for key, value in list(vars(module).items()):
        if isinstance(value, Path) and value.is_relative_to(ROOT):
            setattr(module, key, target / value.relative_to(ROOT))


def snapshot(folder):
    return {
        str(path.relative_to(folder)): path.read_bytes()
        for path in folder.rglob('*')
        if path.is_file()
    }


def response_file(folder, url):
    key = CACHE_BUSTER.sub(lambda m: m[1] if m[2] else '', url)
    return Path(folder) / (hashlib.sha256(key.encode()).hexdigest() + '.json')


def comparable(name, data):
    """Bytes to compare: LF line endings, and the RSS build time (always the current time) removed."""
    data = data.replace(b'\r\n', b'\n')
    if name.replace('\\', '/') == 'feed.xml':
        data = re.sub(rb'<lastBuildDate>.*?</lastBuildDate>', b'<lastBuildDate/>', data)
    return data


def compare(first, second):
    a, b = snapshot(Path(first)), snapshot(Path(second))
    added = sorted(b.keys() - a.keys())
    removed = sorted(a.keys() - b.keys())
    changed = sorted(p for p in a.keys() & b.keys() if comparable(p, a[p]) != comparable(p, b[p]))
    for label, paths in (('added', added), ('removed', removed), ('changed', changed)):
        for path in paths:
            print(f'{label}: {path}')
    total = len(added) + len(removed) + len(changed)
    print(('PASS' if not total else 'FAIL') + f': {len(a)} vs {len(b)} files, {total} differ')
    return 1 if total else 0


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    source = parser.add_mutually_exclusive_group()
    source.add_argument('--record', metavar='DIR', help='save every WP API response to DIR')
    source.add_argument('--replay', metavar='DIR', help='build from responses saved by --record')
    parser.add_argument('--out', metavar='DIR', help='keep the generated copy in DIR')
    parser.add_argument('--compare', nargs=2, metavar=('A', 'B'), help='compare two --out folders')
    args = parser.parse_args()
    if args.compare:
        return compare(*args.compare)
    if args.out and Path(args.out).exists() and not (Path(args.out) / OUT_MARKER).is_file():
        parser.error(f'--out {args.out}: exists and was not created by check-builds.py')

    fetch = bm_build.fetch_json
    cache = {}
    if args.record:
        Path(args.record).mkdir(parents=True, exist_ok=True)

    def cached_fetch(url, **kwargs):
        if url not in cache:
            if args.replay:
                path = response_file(args.replay, url)
                if not path.is_file():
                    raise RuntimeError(f'No recorded response for {url}')
                cache[url] = json.loads(path.read_text(encoding='utf-8'))['data']
            else:
                cache[url] = fetch(url, **kwargs)
                if args.record:
                    response_file(args.record, url).write_text(
                        json.dumps({'url': url, 'data': cache[url]}, ensure_ascii=False),
                        encoding='utf-8',
                    )
        return copy.deepcopy(cache[url])

    bm_build.fetch_json = cached_fetch
    try:
        with tempfile.TemporaryDirectory(prefix='bizmanga-build-check-') as directory:
            target = Path(directory)
            for pattern in INPUTS:
                for source_path in ROOT.glob(pattern):
                    out = target / source_path.relative_to(ROOT)
                    out.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(source_path, out)
            relocate(bm_pricing, target)
            for name in BUILDERS:
                module = load(name)
                relocate(module, target)
                before = snapshot(target)
                log = io.StringIO()
                try:
                    with redirect_stdout(log):
                        result = module.main()
                    if result not in (None, 0):
                        raise RuntimeError(f'{name} returned {result}')
                    first = snapshot(target)
                    with redirect_stdout(log):
                        module.main()
                    second = snapshot(target)
                    # RSS lastBuildDate is intentionally the current time.
                    changed_twice = [
                        p
                        for p in first.keys() | second.keys()
                        if p != 'feed.xml' and first.get(p) != second.get(p)
                    ]
                    if changed_twice:
                        raise AssertionError(f'Non-idempotent build: {changed_twice}')
                except BaseException:
                    print(log.getvalue())
                    raise
                deleted = before.keys() - first.keys()
                changed = sum(before.get(p) != data for p, data in first.items())
                print(
                    f'PASS {name}: generated/updated={changed}, removed={len(deleted)}, repeat is stable'
                )
            # Parse JSON-LD and application/json in all freshly rendered documents.
            for path in target.rglob('*.html'):
                for match in re.finditer(
                    r'<script[^>]*type="application/(?:ld\+)?json"[^>]*>(.*?)</script>',
                    path.read_text(encoding='utf-8'),
                    re.S,
                ):
                    json.loads(match[1])
            if args.out:
                out_dir = Path(args.out)
                if out_dir.exists():
                    # Only replace a folder this tool created; never an arbitrary path such as the repo.
                    if not (out_dir / OUT_MARKER).is_file():
                        raise SystemExit(
                            f'--out {out_dir}: exists and was not created by check-builds.py'
                        )
                    shutil.rmtree(out_dir)
                shutil.copytree(target, out_dir)
                (out_dir / OUT_MARKER).write_text(
                    'created by tools/check-builds.py --out\n', encoding='utf-8'
                )
            source_label = f'replayed from {args.replay}' if args.replay else 'fetched'
            print(
                f'PASS generated JSON; {source_label} {len(cache)} API responses; working tree untouched'
            )
    finally:
        bm_build.fetch_json = fetch
        bm_pricing.ROOT = ROOT
    return 0


if __name__ == '__main__':
    sys.exit(main())
