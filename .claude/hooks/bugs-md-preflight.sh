#!/usr/bin/env bash
# BUGS.md Pre-flight 警告: これから編集/実行する対象が、過去バグの地雷パターンに
# 一致したら該当バグ番号を警告する（ブロックはしない・systemMessageで注意喚起のみ）。
# 元ネタは BUGS.md「着手前チェックリスト」。再発を"着手前"に気づかせる保険。
# 逆フックから呼ばれたclaude内では発火しない（再帰ガード）。
[ -n "$CLAUDE_REVERSE_HOOK" ] && exit 0

input=$(cat)
# 判定材料: 編集対象ファイルパス と Bashコマンド文字列 の両方を見る
f=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
hay="$f $cmd"
[ -z "$(printf '%s' "$hay" | tr -d ' ')" ] && exit 0

warns=""
hit() { warns="$warns\n- $1"; }

# --- BUGS.md リスクパターン → 該当バグ番号（一致したものだけ警告）---
case "$hay" in
  *wordpress*|*contentsx-cms*|*/wp-json/*) hit "#002: WPプラグイン編集は git push だけでは本番反映されない。お名前.comでサーバー手動アップロード必須（memory reference_wp_plugin_location）" ;;
esac
case "$hay" in
  *bm-nav*|*nav.js*|*header*|*ヘッダー*) hit "#003/#014: ヘッダー/ナビ変更はモバイルでハンバーガーが押せなくなる地雷。.bm-nav-cta--line を除外（SVG+span破壊注意）" ;;
esac
case "$hay" in
  *bm-view-type*|*works.js*|*viewer*|*ビューア*) hit "#012/#013: 漫画ビューアは view_type を自前判定せず window.bmViewType.* に委譲。/library と /manga/{id} 両分岐を揃える" ;;
esac
case "$hay" in
  *i18n*|*en.json*|*translateAll*) hit "#005/#008/#015: i18nは読込順(i18n.js→nav.js)固定・translateAll無条件呼び禁止・UIラベルにdata-i18n-skip" ;;
esac
case "$hay" in
  *ContentX/material/*|*material/*) hit "#020: ContentX/material の画像は BizManga が絶対URL参照。削除は両サイト同時grep必須（memory feedback_contentx_material_cross_repo_refs）" ;;
esac
# CSP メタの一括置換（sed -g 全グローバル置換の地雷）
case "$cmd" in
  *sed*Content-Security-Policy*|*sed*-g*csp*|*sed*"s|"*http*) hit "#016: CSPメタの一括書換で sed -g 全グローバル置換は禁止。同じURL文字列がインラインJSにも出るため壊す（memory feedback_csp_sed_safety）。アドレス指定 or Editで行差替" ;;
esac
# href/src を書く系（絶対パス必須）
case "$cmd" in
  *'href="'*|*'src="'*) case "$cmd" in *'href="/'*|*'src="/'*|*'href="http'*|*'src="http'*) : ;; *) hit "#006: href/src は必ず絶対パス(/始まり)。相対パスはサブディレクトリで404" ;; esac ;;
esac

[ -z "$warns" ] && exit 0

jq -n --arg w "$(printf '%b' "$warns")" '{
  systemMessage: ("[BUGS.md Pre-flight] 過去バグの地雷パターンに一致:\($w)\n着手前に BUGS.md 該当項目を確認すること。"),
  hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: ("この操作は過去バグの再発リスクあり:\($w)") }
}'
exit 0
