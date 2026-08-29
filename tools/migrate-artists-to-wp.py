#!/usr/bin/env python3
"""
現在の js/artists.js の内蔵データ（11名）と画像44枚を WordPress へ一括登録する。

一回きりの移行スクリプト。以後は WP 側で追加・編集・並べ替えを行い、
tools/build-artists.py で静的化する。

使い方:
    cd BizManga
    python3 tools/migrate-artists-to-wp.py --dry-run   # 何が登録されるかだけ表示
    python3 tools/migrate-artists-to-wp.py             # 実際に登録

仕様:
- ペンネームは登録しない（記号 A〜K で指名する運用のため）
- 同じ記号の投稿が既にあれば更新する（再実行しても重複しない）
- 画像は同じファイル名が既にメディアにあれば再利用する（毎回増やさない）

⚠️ 認証情報は ~/.config/recruitx-wp/credentials.env（リポジトリ外）。
   パスワードに空白が入るのでシェルの source は使わず Python でパースする。
"""

import argparse
import base64
import json
import mimetypes
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARTISTS_JS = ROOT / "js" / "artists.js"
CRED = pathlib.Path.home() / ".config" / "recruitx-wp" / "credentials.env"
API = "https://cms.contentsx.jp/wp-json"

TAG_MAP = {
    "styleTags": "style",
    "usecaseTags": "usecase",
    "genreTags": "genre",
    "audienceTags": "audience",
    "mediaTags": "medium",
}
GROUP_LABEL = {
    "style": "画風", "usecase": "用途", "genre": "ジャンル",
    "audience": "読者層", "medium": "媒体",
}


def load_auth():
    if not CRED.exists():
        sys.exit(f"認証情報が見つかりません: {CRED}\n"
                 "jou-wp-access スキルの §2 を参照してください。")
    user = pw = None
    for line in CRED.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip()
        if k == "WP_USER":
            user = v
        elif k == "WP_APP_PASSWORD":
            pw = v.replace(" ", "")      # 表示上の空白を除去（そのままだと401）
    if not user or not pw:
        sys.exit("WP_USER / WP_APP_PASSWORD が読み取れません")
    token = base64.b64encode(f"{user}:{pw}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def req(method, path, headers, data=None, ctype="application/json", raw=None):
    url = path if path.startswith("http") else f"{API}{path}"
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    h = dict(headers)
    if body is not None:
        h["Content-Type"] = ctype
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:400]
        sys.exit(f"{method} {url} が失敗 ({e.code}): {detail}")


def parse_creators():
    """artists.js の CREATORS 配列を JSON として抜き出す。
    JS リテラルなので、キーのクォート付与と末尾カンマ除去だけ最小限に直す。"""
    src = ARTISTS_JS.read_text(encoding="utf-8")
    start = src.index("var CREATORS = [")
    i = src.index("[", start)
    depth, j = 0, i
    while j < len(src):
        if src[j] == "[":
            depth += 1
        elif src[j] == "]":
            depth -= 1
            if depth == 0:
                break
        j += 1
    body = src[i:j + 1]

    # ファイル冒頭で定義しているパス変数（var IMG = '...' 等）を実値に展開する。
    # これを見落とすと IMG + "x.webp" が残って JSON パースに失敗する。
    consts = dict(re.findall(r"var\s+([A-Z_][A-Z0-9_]*)\s*=\s*'([^']*)'\s*;", src))

    body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)     # ブロックコメント
    body = re.sub(r"//[^\n]*", "", body)                   # 行コメント
    body = re.sub(r"(\{|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', body)  # キーを "..." に
    body = body.replace("'", '"')

    # 変数 + "文字列" を1つの文字列literalに畳む
    for name, val in consts.items():
        body = re.sub(rf"\b{name}\s*\+\s*\"", '"' + val, body)

    body = re.sub(r'"\s*\+\s*"', "", body)                 # "a" + "b" の連結
    body = re.sub(r",(\s*[}\]])", r"\1", body)             # 末尾カンマ

    leftover = re.search(r"\b[A-Za-z_][A-Za-z0-9_]*\s*\+", body)
    if leftover:
        raise SystemExit(
            "artists.js に未対応の式が残っています: "
            f"{body[max(0, leftover.start()-40):leftover.start()+40]!r}"
        )
    return json.loads(body)


def find_media_by_filename(headers, filename):
    got = req("GET", f"/wp/v2/media?search={urllib.parse.quote(filename)}&per_page=20", headers)
    for m in got:
        src = m.get("source_url", "")
        if src.rsplit("/", 1)[-1].split(".")[0] == filename.split(".")[0]:
            return m["id"]
    return None


def upload_image(headers, path, dry):
    name = path.name
    if dry:
        print(f"    [dry] 画像アップロード: {name}")
        return 0
    existing = find_media_by_filename(headers, name)
    if existing:
        print(f"    既存メディアを再利用: {name} (id={existing})")
        return existing
    ctype = mimetypes.guess_type(name)[0] or "image/webp"
    h = dict(headers)
    h["Content-Disposition"] = f'attachment; filename="{name}"'
    res = req("POST", "/wp/v2/media", h, raw=path.read_bytes(), ctype=ctype)
    print(f"    アップロード: {name} (id={res['id']})")
    return res["id"]


def ensure_group(headers, key, cache, dry):
    slug = f"grp-{key}"
    if slug in cache:
        return cache[slug]
    got = req("GET", f"/wp/v2/cx-artist-tags?slug={slug}", headers)
    if got:
        cache[slug] = got[0]["id"]
        return cache[slug]
    if dry:
        cache[slug] = 0
        return 0
    res = req("POST", "/wp/v2/cx-artist-tags", headers,
              {"name": GROUP_LABEL[key], "slug": slug})
    cache[slug] = res["id"]
    return res["id"]


def ensure_tag(headers, name, parent, cache, dry):
    ck = f"{parent}:{name}"
    if ck in cache:
        return cache[ck]
    got = req("GET", f"/wp/v2/cx-artist-tags?search={urllib.parse.quote(name)}&per_page=100", headers)
    for t in got:
        if t["name"] == name and t.get("parent") == parent:
            cache[ck] = t["id"]
            return t["id"]
    if dry:
        cache[ck] = 0
        return 0
    res = req("POST", "/wp/v2/cx-artist-tags", headers, {"name": name, "parent": parent})
    cache[ck] = res["id"]
    return res["id"]


def local_path(url):
    """artists.js の画像URL/パスをローカルファイルに解決する。"""
    if url.startswith("/material/"):
        return ROOT / url.lstrip("/")
    m = re.match(r"https://contentsx\.jp/material/(.+)", url)
    if m:
        return ROOT.parent / "ContentX" / "material" / m.group(1)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="登録せず内容だけ表示")
    args = ap.parse_args()
    dry = args.dry_run

    headers = load_auth()
    creators = parse_creators()
    print(f"artists.js から {len(creators)} 名を読み込みました\n")

    existing = {} if dry else {
        (p.get("meta") or {}).get("cx_artist_symbol") or p["title"]["rendered"]: p["id"]
        for p in req("GET", "/wp/v2/cx-artists?per_page=100&status=any", headers)
    }
    gcache, tcache = {}, {}

    for i, c in enumerate(creators):
        print(f"[{c['id']}] {c['title']}")

        thumb_id = 0
        p = local_path(c.get("thumbnail", ""))
        if p and p.exists():
            thumb_id = upload_image(headers, p, dry)
        elif p:
            print(f"    ⚠️ サムネが見つかりません: {p}")

        gallery_ids = []
        for g in c.get("gallery", []):
            gp = local_path(g.get("src", ""))
            if gp and gp.exists():
                gid = upload_image(headers, gp, dry)
                if gid:
                    gallery_ids.append(str(gid))
            elif gp:
                print(f"    ⚠️ 作例が見つかりません: {gp}")

        term_ids = []
        for js_key, wp_key in TAG_MAP.items():
            names = c.get(js_key) or []
            if not names:
                continue
            parent = ensure_group(headers, wp_key, gcache, dry)
            for n in names:
                tid = ensure_tag(headers, n, parent, tcache, dry)
                if tid:
                    term_ids.append(tid)
        print(f"    タグ {len(term_ids)} 件 / 作例 {len(gallery_ids)} 枚 / 表示順 {(i+1)*10}")

        payload = {
            "title": c["title"],
            "slug": c.get("slug") or "",
            "status": "publish",
            "meta": {
                "cx_artist_symbol": c["id"],
                "cx_artist_order": (i + 1) * 10,
                "cx_artist_summary": c.get("summary", ""),
                "cx_artist_detail": c.get("detail", ""),
                "cx_artist_works": "\n".join(c.get("works", [])),
                "cx_artist_years": c.get("yearsActive", ""),
                "cx_artist_gallery": ",".join(gallery_ids),
            },
        }
        if thumb_id:
            payload["featured_media"] = thumb_id
        if term_ids:
            payload["cx_artist_tag"] = term_ids

        if dry:
            print("    [dry] 登録をスキップ\n")
            continue

        pid = existing.get(c["id"])
        if pid:
            req("POST", f"/wp/v2/cx-artists/{pid}", headers, payload)
            print(f"    更新しました (id={pid})\n")
        else:
            res = req("POST", "/wp/v2/cx-artists", headers, payload)
            print(f"    新規作成しました (id={res['id']})\n")

    print("完了。WP管理画面『ビズマンガ → 漫画家』で確認し、")
    print("その後 python3 tools/build-artists.py を実行してください。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
