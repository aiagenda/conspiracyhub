#!/usr/bin/env bash
# Run the five daily ingest jobs when /api/scheduler/daily-ingest is not deployed.
# Prefer tick + job_key (manual run); otherwise loop due cron ticks (max 2 jobs/request).
set -euo pipefail

SITE="${SITE_URL:-https://www.the-theorist.com}"
SITE="${SITE%/}"
AUTH="${CRON_SECRET:?Set CRON_SECRET to the same value as Vercel CRON_SECRET}"
LOG_DIR="${LOG_DIR:-/opt/cursor/artifacts}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/daily-ingest-tick-$(date -u +%F).log"

keys=(news_main uap_nuforc outbreak_refresh reddit_radar_scan uap_full_refresh)

probe_code=$(curl -sS --max-time 60 -o /tmp/tick-probe.json -w "%{http_code}" \
  -X POST "$SITE/api/scheduler/tick" \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"job_key":"__probe__"}')
# Deploys without job_key support return 200 + due_count; newer ones return 400 + allowed list.
supports_job_key=false
if [[ "$probe_code" == "400" ]] && grep -q '"allowed"' /tmp/tick-probe.json 2>/dev/null; then
  supports_job_key=true
fi

if [[ "$supports_job_key" == "true" ]]; then
  echo "Using tick job_key fallback" | tee -a "$LOG"
  for key in "${keys[@]}"; do
    echo "=== tick job_key $key $(date -u +%FT%TZ) ===" | tee -a "$LOG"
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
  echo "All daily ingest jobs finished OK (tick job_key)" | tee -a "$LOG"
  exit 0
fi

echo "Tick has no job_key support; running due cron jobs in rounds" | tee -a "$LOG"
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
  due_count=$(node -e "const j=require('/tmp/tick-body.json'); process.stdout.write(String(j.due_count??0));")
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