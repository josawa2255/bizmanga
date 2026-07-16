#!/usr/bin/env bash
# 行き詰まり検出: 同じファイルを5回連続で編集したら警告する。
# 逆フックから呼ばれたclaudeの中では発火させない（再帰ガード）。
[ -n "$CLAUDE_REVERSE_HOOK" ] && exit 0

input=$(cat)
sid=$(printf '%s' "$input" | jq -r '.session_id // "x"')
f=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$f" ] && exit 0

state="/tmp/claude-stuck-$sid"
prev=$(cat "$state" 2>/dev/null)
pf=${prev%%|*}; pc=${prev##*|}
if [ "$f" = "$pf" ]; then c=$((pc + 1)); else c=1; fi
printf '%s|%s' "$f" "$c" > "$state"

# 5回ごと(5,10,15…)に1度だけ警告
if [ "$c" -ge 5 ] && [ $((c % 5)) -eq 0 ]; then
  jq -n --arg f "$f" --arg c "$c" '{
    systemMessage: ("[行き詰まり?] 同じファイル(\($f))を\($c)回連続で編集中。/clear で仕切り直すか、別アプローチを検討してみては。"),
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: ("同一ファイルを\($c)回連続編集中。袋小路の可能性。前提と別解を一度見直すこと。") }
  }'
fi
exit 0
