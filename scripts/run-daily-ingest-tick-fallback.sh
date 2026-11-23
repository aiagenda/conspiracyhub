#!/usr/bin/env bash
# Fallback when /api/scheduler/daily-ingest is not deployed — POST job_key to /api/scheduler/tick.
set -euo pipefail

SITE="${SITE_URL:-https://www.the-theorist.com}"
SITE="${SITE%/}"
AUTH="${CRON_SECRET:?Set CRON_SECRET to the same value as Vercel CRON_SECRET}"
LOG_DIR="${LOG_DIR:-/opt/cursor/artifacts}"
mkdir -p "$LOG_DIR"
LOG="${LOG:-$LOG_DIR/daily-ingest-$(date -u +%F).log}"

keys=(news_main uap_nuforc outbreak_refresh reddit_radar_scan uap_full_refresh)

probe_code=$(curl -sS --max-time 30 -o /tmp/daily-ingest-probe.json -w "%{http_code}" \
  -X POST "$SITE/api/scheduler/tick" \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"job_key":"__probe__"}')
if [[ "$probe_code" != "400" ]]; then
  echo "Tick job_key probe failed HTTP $probe_code (expected 400 with allowed keys). Prod may be on an older build." | tee -a "$LOG" >&2
  cat /tmp/daily-ingest-probe.json | tee -a "$LOG" >&2
  exit 1
fi

for key in "${keys[@]}"; do
  echo "=== tick fallback $key $(date -u +%FT%TZ) ===" | tee -a "$LOG"
  http_code=$(curl -sS --max-time 600 -o /tmp/daily-ingest-body.json -w "%{http_code}" \
    -X POST "$SITE/api/scheduler/tick" \
    -H "Authorization: Bearer $AUTH" \
    -H "Content-Type: application/json" \
    -d "{\"job_key\":\"$key\"}")
  cat /tmp/daily-ingest-body.json | tee -a "$LOG"
  echo | tee -a "$LOG"
  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    echo "Failed $key HTTP $http_code" | tee -a "$LOG" >&2
    exit 1
  fi
done

echo "All daily ingest jobs finished OK (tick fallback)" | tee -a "$LOG"