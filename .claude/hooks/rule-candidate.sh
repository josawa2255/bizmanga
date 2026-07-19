#!/usr/bin/env bash
# 繰り返し指摘→ルール化候補: ユーザー発言に「繰り返し/恒常的な指摘」のシグナルがあれば、
# 逆フック(claude -p)で「ルール化すべきか」を判断し、該当時のみ
# docs/planning/RULE-CANDIDATES.md に候補を1行追記する（CLAUDE.md本体は直接いじらない）。
# 再帰ガード: 逆フックから呼ばれたclaude内では発火しない。
[ -n "$CLAUDE_REVERSE_HOOK" ] && exit 0

input=$(cat)
prompt=$(printf '%s' "$input" | jq -r '.prompt // .user_prompt // .message.content // empty' 2>/dev/null)
[ -z "$prompt" ] && exit 0

# 事前フィルタ: 繰り返し/恒常指摘のシグナルが無ければ即終了（claudeを呼ばない＝課金ゼロ）
printf '%s' "$prompt" | grep -qE '毎回|何回も|何度も|何度言|前にも|さっきも|またか|また同じ|繰り返し|いつも|ルール化|学習して|覚えて' || exit 0

dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -z "$dir" ] && exit 0
cd "$dir" || exit 0

req="次のユーザー発言は繰り返しの指摘・恒常的な要望の可能性があります:
---
$prompt
---
これがこのワークスペースの恒常ルール(CLAUDE.md / docs/DOC-RULES.md)に追記すべきものか判断してください。すべきなら docs/planning/RULE-CANDIDATES.md の末尾に「- $(date +%F): <ルール案を1行> （根拠: 元発言の要約）」を1行追記する。CLAUDE.md等のハブ本体は直接書き換えないこと。ルール化不要なら何もせず終了。簡潔に。"

# テスト用ドライラン
if [ -n "$RC_DRYRUN" ]; then
  echo "WOULD CALL claude -p (budget 0.20) with prompt len=${#req}"
  exit 0
fi

export CLAUDE_REVERSE_HOOK=1
claude -p --max-budget-usd 0.20 --permission-mode acceptEdits --allowedTools "Read Edit Write" "$req" >/dev/null 2>&1
exit 0
