"""IndexNow の設定（サイトとキー）。送信（tools/indexnow-ping.py）と公開物（tools/build-site-artifact.py）の両方が読む。

キーファイルはリポジトリに置かない。公開時に build-site-artifact.py がサイト直下の /{KEY}.txt（中身は KEY だけ）を作る。
送信では keyLocation を付けない（IndexNow は keyLocation が無いとき https://{HOST}/{KEY}.txt を取りに来て、
中身がキーと一致するかで所有を確かめる）。キーを替えるときは KEY だけ替える。
"""
import re

HOST = "bizmanga.contentsx.jp"
KEY = "d3aa5088bd3c49f988a9c1ead3f8206a"

# IndexNow の決まり: キーは英数字とハイフンの 8〜128 文字
_KEY_FORMAT = re.compile(r"[A-Za-z0-9-]{8,128}")


def key_file_name():
    """公開するキーファイルのサイト直下の名前（{KEY}.txt）。KEY が IndexNow の書式に合わなければ ValueError。
    KEY は呼ぶたびにモジュールから読む（既定値に束縛しない）。"""
    if not isinstance(KEY, str) or not _KEY_FORMAT.fullmatch(KEY):
        raise ValueError("IndexNow KEY must be 8-128 letters, digits or hyphens (tools/bm_indexnow.py)")
    return f"{KEY}.txt"
