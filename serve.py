"""
BizManga ローカル開発サーバー
クリーンURL対応（.htmlなしでアクセス可能）

使い方: python3 serve.py
ブラウザで http://localhost:8000 を開く
停止: Ctrl+C
"""

import http.server
import os

PORT = 8000

class CleanURLHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Remove query string for file lookup
        path = self.path.split('?')[0]

        # If path doesn't have extension and isn't a directory, try .html
        if path != '/' and '.' not in os.path.basename(path):
            html_path = path + '.html'
            if os.path.exists(self.directory + html_path):
                self.path = html_path + ('?' + self.path.split('?')[1] if '?' in self.path else '')

        return super().do_GET()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with http.server.HTTPServer(('', PORT), CleanURLHandler) as httpd:
        print(f'BizManga server running at http://localhost:{PORT}')
        print('Press Ctrl+C to stop')
        httpd.serve_forever()
