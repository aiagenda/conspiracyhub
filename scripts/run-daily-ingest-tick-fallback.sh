#!/usr/bin/env bash
# Run due daily ingest jobs via /api/scheduler/tick (max 2 jobs per request).
set -euo pipefail

SITE="${SITE_URL:-https://www.the-theorist.com}"
SITE="${SITE%/}"
AUTH="${CRON_SECRET:?Set CRON_SECRET to the same value as Vercel CRON_SECRET}"
LOG_DIR="${LOG_DIR:-/opt/cursor/artifacts}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/daily-ingest-tick-$(date -u +%F).log"

max_rounds="${TICK_MAX_ROUNDS:-30}"
round=0
last_due=-1

while (( round < max_rounds )); do
  round=$((round + 1))
  echo "=== tick round $round $(date -u +%FT%TZ) ===" | tee -a "$LOG"
  http_code=$(curl -sS --max-time 600 -o /tmp/tick-body.json -w "%{http_code}" \
    -X POST "$SITE/api/scheduler/tick" \
    -H "Authorization: Bearer $AUTH")
  cat /tmp/tick-body.json | tee -a "$LOG"
  echo | tee -a "$LOG"
  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    echo "Tick failed HTTP $http_code" | tee -a "$LOG" >&2
    exit 1
  fi
  due_count=$(node -e "const j=require('/tmp/tick-body.json'); process.stdout.write(String(j.deferred_count!==undefined?(j.due_count??0):(j.due_count??0)));")
  deferred=$(node -e "const j=require('/tmp/tick-body.json'); process.stdout.write(String(j.deferred_count??0));")
  echo "due_count=$due_count deferred=$deferred" | tee -a "$LOG"
  if [[ "$due_count" == "0" ]]; then
    echo "All due jobs finished" | tee -a "$LOG"
    exit 0
  fi
  if [[ "$due_count" == "$last_due" && "$deferred" == "0" ]]; then
    echo "No progress (stuck at due_count=$due_count)" | tee -a "$LOG" >&2
    exit 2
  fi
  last_due=$due_count
done

echo "Exceeded TICK_MAX_ROUNDS=$max_rounds with jobs still due" | tee -a "$LOG" >&2
exit 2