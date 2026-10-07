"""Test-only module loading, local HTTP server and isolated Git helpers."""

import importlib.util
import os
import subprocess
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_tool(filename):
    path = ROOT / 'tools' / filename
    if path.suffix != '.py':
        path = path.with_suffix('.py')
    spec = importlib.util.spec_from_file_location(path.stem.replace('-', '_'), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def git_test_env():
    # Isolate test identities, config and signing from the user's setup.
    return dict(
        os.environ,
        GIT_CONFIG_NOSYSTEM='1',
        GIT_CONFIG_GLOBAL=os.devnull,
        GIT_AUTHOR_NAME='Test',
        GIT_AUTHOR_EMAIL='test@example.test',
        GIT_COMMITTER_NAME='Test',
        GIT_COMMITTER_EMAIL='test@example.test',
        GIT_TERMINAL_PROMPT='0',
        GIT_EDITOR='true',
    )


def git_runner(env):
    def git(cwd, *args):
        return subprocess.check_output(
            ['git', *args], cwd=cwd, env=env, stderr=subprocess.STDOUT, text=True
        )

    return git


def make_handler(directory):
    """リポジトリ直下の serve.py（クリーンURL）を再利用。無ければ同等の最小実装で代替"""
    base_cls = SimpleHTTPRequestHandler
    if os.path.isfile(os.path.join(directory, "serve.py")):
        try:
            sys.path.insert(0, directory)
            import serve  # BizManga/serve.py

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
            if (
                not os.path.exists(full)
                and not os.path.splitext(full)[1]
                and os.path.isfile(full + ".html")
            ):
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


def start_server(directory, port, *, handler_class=None):
    directory = str(directory)
    handler = partial(handler_class or make_handler(directory), directory=directory)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd
