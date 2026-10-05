#!/usr/bin/env python3
"""Read the live WP API and validate builds in a temporary copy; never publish."""

from contextlib import redirect_stdout
import copy
from bm_test_support import load_tool as load
import io
from pathlib import Path
import shutil
import tempfile

import bm_build
import bm_pricing

ROOT = Path(__file__).resolve().parents[1]


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


def main():
    fetch = bm_build.fetch_json
    cache = {}

    def cached_fetch(url, **kwargs):
        if url not in cache:
            cache[url] = fetch(url, **kwargs)
        return copy.deepcopy(cache[url])

    bm_build.fetch_json = cached_fetch
    try:
        with tempfile.TemporaryDirectory(prefix='bizmanga-build-check-') as directory:
            target = Path(directory)
            for pattern in (
                '*.html',
                '*.xml',
                'column/*.html',
                'works/**/*.html',
                'tools/templates/*',
                'js/artists-data.js',
                'js/bm-pricing.js',
                'material/images/og/works/*',
            ):
                for source in ROOT.glob(pattern):
                    out = target / source.relative_to(ROOT)
                    out.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(source, out)
            relocate(bm_pricing, target)
            for name in (
                'build-works',
                'build-columns',
                'build-artists',
                'build-feed',
                'build-lp-cases',
            ):
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
            import re
            import json

            for path in target.rglob('*.html'):
                for match in re.finditer(
                    r'<script[^>]*type="application/(?:ld\+)?json"[^>]*>(.*?)</script>',
                    path.read_text(encoding='utf-8'),
                    re.S,
                ):
                    json.loads(match[1])
            print(
                f'PASS generated JSON; fetched {len(cache)} API responses; working tree untouched'
            )
    finally:
        bm_build.fetch_json = fetch
        bm_pricing.ROOT = ROOT


if __name__ == '__main__':
    main()
