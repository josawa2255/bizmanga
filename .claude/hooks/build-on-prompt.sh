#!/usr/bin/env bash
# ビルド自動再実行: ユーザープロンプトにコラム/works/CMS反映系のKWがあれば、
# 該当する静的ビルドスクリプトを先回りで実行し、結果を additionalContext に注入する。
# 「コラム表示出てる？」と聞かれる前にビルド済みにしておく保険。
# WP編集→静的ビルド未反映で「本文/画像が出ない」を防ぐ（memory feedback_wp_static_rebuild）。
# 逆フックから呼ばれたclaude内では発火しない（再帰ガード）。
[ -n "$CLAUDE_REVERSE_HOOK" ] && exit 0

input=$(cat)
prompt=$(printf '%s' "$input" | jq -r '.prompt // .user_prompt // .message.content // empty' 2>/dev/null)
[ -z "$prompt" ] && exit 0

# 事前フィルタ: 反映確認・ビルド系KWが無ければ即終了（何も実行しない）
printf '%s' "$prompt" | grep -qiE 'コラム|column|works|制作事例|作品|ビルド|build|cms反映|wp反映|反映され|静的|記事一覧|一覧に出' || exit 0

dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -z "$dir" ] && exit 0
cd "$dir" || exit 0

# python 実行系を解決（python3 優先）
PY=$(command -v python3 || command -v python)
[ -z "$PY" ] && exit 0

# 実行対象を KW から決める（存在するスクリプトだけ）。B/C 両対応。
targets=()
add() { [ -f "$1" ] && targets+=("$1"); }

low=$(printf '%s' "$prompt" | tr 'A-Z' 'a-z')
case "$low" in
  *コラム*|*column*|*記事*)
    add "BizManga/tools/build-columns.py"
    add "ContentX/tools/build-c-columns.py" ;;
esac
case "$low" in
  *works*|*制作事例*|*作品*)
    add "BizManga/tools/build-works.py" ;;
esac
# 汎用「ビルド/反映」だけの時は代表的なコラム2本を回す
if [ ${#targets[@]} -eq 0 ]; then
  add "BizManga/tools/build-columns.py"
  add "ContentX/tools/build-c-columns.py"
fi

[ ${#targets[@]} -eq 0 ] && exit 0

# 並列実行（各スクリプトの stdout/stderr は握りつぶし、成否だけ集計）
results=""
pids=""
for t in "${targets[@]}"; do
  ( "$PY" "$t" >/dev/null 2>&1 ) &
  pids="$pids $!:$t"
done
for pt in $pids; do
  pid=${pt%%:*}; t=${pt##*:}
  if wait "$pid"; then results="$results\n- OK: $t"; else results="$results\n- 失敗(要確認): $t"; fi
done

jq -n --arg r "$(printf '%b' "$results")" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: ("[自動ビルド再実行] WP編集の静的反映のため関連ビルドを実行しました:\($r)\n表示が出ない場合はこのビルド結果を確認すること。")
  }
}'
exit 0
