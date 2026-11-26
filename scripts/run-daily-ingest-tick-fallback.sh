#!/usr/bin/env bash
# When /api/scheduler/daily-ingest is missing, run each ingest job via POST /api/scheduler/tick
# with body {"job_key":"..."} (manual trigger — works before 09:00 UTC due window).
set -euo pipefail

SITE="${SITE_URL:-https://www.the-theorist.com}"
SITE="${SITE%/}"
AUTH="${CRON_SECRET:?Set CRON_SECRET to the same value as Vercel CRON_SECRET}"
LOG_DIR="${LOG_DIR:-/opt/cursor/artifacts}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/daily-ingest-tick-$(date -u +%F).log"

keys=(news_main uap_nuforc outbreak_refresh reddit_radar_scan uap_full_refresh)

for key in "${keys[@]}"; do
  echo "=== tick job_key=$key $(date -u +%FT%TZ) ===" | tee -a "$LOG"
  http_code=$(curl -sS --max-time 600 -o /tmp/tick-job-body.json -w "%{http_code}" \
    -X POST "$SITE/api/scheduler/tick" \
    -H "Authorization: Bearer $AUTH" \
    -H "Content-Type: application/json" \
    -d "{\"job_key\":\"$key\"}")
  cat /tmp/tick-job-body.json | tee -a "$LOG"
  echo | tee -a "$LOG"
  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    echo "Failed $key HTTP $http_code" | tee -a "$LOG" >&2
    exit 1
  fi
done

echo "All daily ingest jobs finished via tick fallback" | tee -a "$LOG"