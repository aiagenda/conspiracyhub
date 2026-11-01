import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_INGEST_JOB_KEYS,
  isDailyIngestJobKey,
} from "../src/lib/server/dailyIngestJobs";

test("daily ingest job keys", () => {
  assert.equal(DAILY_INGEST_JOB_KEYS.length, 5);
  assert.ok(isDailyIngestJobKey("news_main"));
  assert.ok(isDailyIngestJobKey("uap_full_refresh"));
  assert.equal(isDailyIngestJobKey("weekly_briefing"), false);
});
