import { createClient } from "@supabase/supabase-js";
import { runScraper } from "@/app/api/scraper/route";
import { runUapScrape } from "@/app/api/uap-sightings/route";

export type ScraperJob = {
  id: string;
  job_key: string;
  name: string;
  target: "news_scraper" | "uap_scraper" | "article_writer";
  schedule_cron: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
};

type RunStatus = "running" | "success" | "failed" | "skipped";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

export function checkCronAuth(authHeader: string | null): boolean {
  const secret = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  return secret === process.env.CRON_SECRET || process.env.NODE_ENV !== "production";
}

/** Supports 5-part cron with wildcard, number, step, and comma-list tokens. */
export function matchesCronNow(cronExpr: string, now = new Date()): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hour, dom, mon, dow] = parts;
  const vals = [now.getUTCMinutes(), now.getUTCHours(), now.getUTCDate(), now.getUTCMonth() + 1, now.getUTCDay()];

  function match(part: string, value: number): boolean {
    if (part === "*") return true;
    if (part.includes(",")) return part.split(",").some((p) => match(p.trim(), value));
    if (part.startsWith("*/")) {
      const step = Number(part.slice(2));
      return Number.isFinite(step) && step > 0 && value % step === 0;
    }
    const n = Number(part);
    return Number.isFinite(n) && n === value;
  }

  return [min, hour, dom, mon, dow].every((part, idx) => match(part, vals[idx]));
}


async function insertRun(jobId: string, trigger: string) {
  const db = admin();
  const { data, error } = await db
    .from("scraper_runs")
    .insert({ job_id: jobId, trigger, status: "running" })
    .select("id, started_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create run");
  return data as { id: string; started_at: string };
}

async function finishRun(
  runId: string,
  status: RunStatus,
  fields: { httpStatus?: number; result?: unknown; error?: string; startedAt: string }
) {
  const finishedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.parse(finishedAt) - Date.parse(fields.startedAt));
  const db = admin();
  await db
    .from("scraper_runs")
    .update({
      status,
      http_status: fields.httpStatus ?? null,
      result: fields.result ?? null,
      error_text: fields.error ?? null,
      duration_ms: durationMs,
      finished_at: finishedAt,
    })
    .eq("id", runId);
}

async function runNewsScraper(): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return { ok: false, status: 500, payload: { error: "OPENAI_API_KEY missing" } };
  try {
    const payload = await runScraper(openAiKey);
    return { ok: true, status: 200, payload };
  } catch (e) {
    return { ok: false, status: 500, payload: { error: e instanceof Error ? e.message : String(e) } };
  }
}

async function runUapScraper(config: Record<string, unknown> | null): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const maxNewRaw = config?.max_new;
  const maxNew = Math.min(Math.max(
    typeof maxNewRaw === "number" ? maxNewRaw : parseInt(String(maxNewRaw ?? "70"), 10) || 70,
    1
  ), 120);
  try {
    const payload = await runUapScrape(maxNew);
    return { ok: true, status: 200, payload };
  } catch (e) {
    return { ok: false, status: 500, payload: { error: e instanceof Error ? e.message : String(e) } };
  }
}

async function runArticleWriter(config: Record<string, unknown> | null): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const mode = (config?.mode as string) ?? "news_jacking";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/generate-article`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.CRON_SECRET ?? ""}`,
      },
      body: JSON.stringify({ mode }),
      signal: AbortSignal.timeout(90_000),
    });
    const payload = await res.json();
    return { ok: res.ok, status: res.status, payload };
  } catch (e) {
    return { ok: false, status: 500, payload: { error: e instanceof Error ? e.message : String(e) } };
  }
}

export async function executeJob(job: ScraperJob, trigger: "cron" | "manual") {
  const db = admin();

  const { data: latest } = await db
    .from("scraper_runs")
    .select("started_at,status")
    .eq("job_id", job.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.status === "running" && Date.now() - Date.parse(latest.started_at) < 15 * 60_000) {
    return { skipped: true, reason: "already_running" };
  }

  const run = await insertRun(job.id, trigger);
  try {
    const resp =
      job.target === "news_scraper"
        ? await runNewsScraper()
        : job.target === "article_writer"
        ? await runArticleWriter(job.config ?? {})
        : await runUapScraper(job.config ?? {});

    await finishRun(run.id, resp.ok ? "success" : "failed", {
      startedAt: run.started_at,
      httpStatus: resp.status,
      result: resp.payload,
      error: resp.ok ? undefined : (
        typeof resp.payload === "object" && resp.payload !== null && "error" in (resp.payload as Record<string, unknown>)
          ? String((resp.payload as Record<string, unknown>).error)
          : `HTTP ${resp.status} — check server logs`
      ),
    });

    return { skipped: false, ok: resp.ok, status: resp.status, payload: resp.payload };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishRun(run.id, "failed", { startedAt: run.started_at, error: msg });
    return { skipped: false, ok: false, status: 500, payload: { error: msg } };
  }
}

export async function getSchedulerSnapshot() {
  const db = admin();
  const { data: jobs, error: jobsErr } = await db
    .from("scraper_jobs")
    .select("id,job_key,name,target,schedule_cron,enabled,config")
    .order("name", { ascending: true });

  if (jobsErr) throw new Error(jobsErr.message);

  const jobList = (jobs ?? []) as ScraperJob[];
  const jobIds = jobList.map((j) => j.id);
  const { data: runs } = jobIds.length
    ? await db
        .from("scraper_runs")
        .select("id,job_id,trigger,status,started_at,finished_at,duration_ms,http_status,error_text,result")
        .in("job_id", jobIds)
        .order("started_at", { ascending: false })
        .limit(200)
    : { data: [] as Array<Record<string, unknown>> };

  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const r of runs ?? []) {
    const list = grouped.get(String(r.job_id)) ?? [];
    list.push(r as Record<string, unknown>);
    grouped.set(String(r.job_id), list);
  }

  const jobsWithRuns = jobList.map((j) => ({
    ...j,
    runs: (grouped.get(j.id) ?? []).slice(0, 10),
    last_run: (grouped.get(j.id) ?? [])[0] ?? null,
  }));

  return { jobs: jobsWithRuns };
}
