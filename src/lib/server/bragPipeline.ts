import { execFile } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import {
  buildBragCompositionHtml,
  bragHyperframesJson,
  bragPackageJson,
  type BragPlanPayload,
} from "@/lib/server/bragComposition";
import {
  BRAG_FORMATS,
  THE_THEORIST_BRAG_CONTEXT,
  type BragFormat,
  type BragTonePreset,
} from "@/lib/server/bragProjectContext";

const execFileAsync = promisify(execFile);

function isVercelServerless(): boolean {
  return process.env.VERCEL === "1";
}

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

/** Writable job workspace — /tmp on Vercel (read-only /var/task elsewhere). */
function bragJobsDir(): string {
  const custom = process.env.BRAG_JOBS_DIR?.trim();
  if (custom) return custom;
  if (isVercelServerless()) return path.join("/tmp", "brag-jobs");
  return path.join(process.cwd(), "var", "brag-jobs");
}

function bragAssetsDir(): string {
  const custom = process.env.BRAG_ASSETS_PATH?.trim();
  if (custom) return custom;
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(home, ".claude", "skills", "brag", "assets");
}

function publicVideoDir(): string {
  if (isVercelServerless()) return path.join("/tmp", "brag-output");
  return path.join(process.cwd(), "public", "brag");
}

async function canRenderVideo(): Promise<boolean> {
  if (process.env.BRAG_RENDER === "0" || isVercelServerless()) return false;
  return ffmpegAvailable();
}

export type BragJobRow = {
  id: string;
  status: string;
  tone: string;
  format: string;
  title: string | null;
  creative_direction: string | null;
  plan_json: BragPlanPayload | null;
  share_copy: string | null;
  error_text: string | null;
  video_path: string | null;
  duration_sec: number | null;
  created_at: string;
  finished_at: string | null;
};

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const PLAN_SYSTEM = `You plan short launch videos (15-22 seconds) for The Theorist using the /brag creative laws.

Return ONLY valid JSON:
{
  "product_name": "The Theorist",
  "hook": "opening line — first 2 seconds, must grab attention",
  "angle": "creative premise in one sentence",
  "share_copy": "1-2 sentences for Twitter/X — specific, not corporate",
  "total_duration_sec": 18,
  "scenes": [
    {
      "id": "scene-hook",
      "name": "Hook",
      "duration_sec": 2.5,
      "headline": "short uppercase-friendly headline",
      "subline": "optional supporting line",
      "detail": "optional third line"
    }
  ]
}

Rules:
- 4-6 scenes, durations must sum to 15-22 seconds.
- Scene 1 is the hook. Last scene is outro with URL or CTA.
- At least 2 scenes must mention specific product features (Feed scores, Oracle board, UAP, blog reports, etc.).
- Headlines max ~8 words. Readable on mobile.
- Match the requested tone preset in pacing and word choice.
- No generic SaaS language.`;

async function generateBragPlan(opts: {
  tone: BragTonePreset;
  format: BragFormat;
  title?: string;
  creativeDirection?: string;
}): Promise<BragPlanPayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const { width, height } = BRAG_FORMATS[opts.format];
  const user = `${THE_THEORIST_BRAG_CONTEXT}

Tone preset: ${opts.tone}
Format: ${opts.format} (${width}x${height})
${opts.title ? `Working title: ${opts.title}` : ""}
${opts.creativeDirection ? `Creative direction: ${opts.creativeDirection}` : ""}

Plan the brag video storyboard as JSON.`;

  return callOpenAIJSON<BragPlanPayload>({
    apiKey,
    system: PLAN_SYSTEM,
    user,
    maxTokens: 2500,
    model: "gpt-4o",
  });
}

async function copyMusicAsset(jobDir: string): Promise<boolean> {
  const musicDir = path.join(bragAssetsDir(), "music");
  const candidates = [
    "happy-beats-business-moves-vol-9-by-ende-dot-app.mp3",
    "happy-beats-business-moves-vol-1-by-ende-dot-app.mp3",
  ];
  await mkdir(path.join(jobDir, "assets", "music"), { recursive: true });
  for (const file of candidates) {
    const src = path.join(musicDir, file);
    try {
      await cp(src, path.join(jobDir, "assets", "music", "track.mp3"));
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

async function writeJobWorkspace(jobId: string, plan: BragPlanPayload, format: BragFormat): Promise<string> {
  const jobDir = path.join(bragJobsDir(), jobId);
  await mkdir(jobDir, { recursive: true });
  await writeFile(path.join(jobDir, "index.html"), buildBragCompositionHtml(plan, format), "utf8");
  await writeFile(path.join(jobDir, "hyperframes.json"), JSON.stringify(bragHyperframesJson(), null, 2), "utf8");
  await writeFile(path.join(jobDir, "package.json"), JSON.stringify(bragPackageJson(jobId), null, 2), "utf8");
  await writeFile(path.join(jobDir, "brag-plan.json"), JSON.stringify(plan, null, 2), "utf8");
  await copyMusicAsset(jobDir);
  return jobDir;
}

async function renderHyperframes(jobDir: string): Promise<string> {
  await execFileAsync("npx", ["--yes", "hyperframes@0.7.78", "lint"], {
    cwd: jobDir,
    timeout: 120_000,
    env: { ...process.env, CI: "1" },
  });

  const outPath = path.join(jobDir, "brag.mp4");
  await execFileAsync(
    "npx",
    ["--yes", "hyperframes@0.7.78", "render", "--output", "brag.mp4", "--quality", "draft"],
    { cwd: jobDir, timeout: 600_000, env: { ...process.env, CI: "1" } },
  );

  await readFile(outPath);
  return outPath;
}

async function publishVideo(jobId: string, localMp4: string): Promise<string | null> {
  if (isVercelServerless()) return null;
  await mkdir(publicVideoDir(), { recursive: true });
  const publicName = `${jobId}.mp4`;
  const dest = path.join(publicVideoDir(), publicName);
  await cp(localMp4, dest);
  return `/brag/${publicName}`;
}

async function ensureJobWorkspace(job: BragJobRow): Promise<string> {
  const jobDir = path.join(bragJobsDir(), job.id);
  try {
    await readFile(path.join(jobDir, "index.html"));
    return jobDir;
  } catch {
    /* rebuild below */
  }
  const plan = job.plan_json;
  if (!plan) throw new Error("No plan_json on job — regenerate from admin first");
  const format = (job.format as BragFormat) || "landscape";
  return writeJobWorkspace(job.id, plan, format);
}

export async function listBragJobs(limit = 20): Promise<BragJobRow[]> {
  const { data, error } = await getAdmin()
    .from("brag_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as BragJobRow[];
}

export type CreateBragJobParams = {
  tone?: BragTonePreset;
  format?: BragFormat;
  title?: string;
  creativeDirection?: string;
};

export async function createAndRunBragJob(params: CreateBragJobParams): Promise<BragJobRow> {
  const admin = getAdmin();
  const tone = params.tone ?? "default";
  const format = params.format ?? "landscape";

  const { data: inserted, error: insErr } = await admin
    .from("brag_jobs")
    .insert({
      status: "planning",
      tone,
      format,
      title: params.title?.trim() || null,
      creative_direction: params.creativeDirection?.trim() || null,
    })
    .select("*")
    .single();

  if (insErr || !inserted) {
    const msg = insErr?.message ?? "insert failed";
    if (/brag_jobs/i.test(msg)) {
      throw new Error("brag_jobs table missing — run migration 20260728140000_brag_jobs.sql in Supabase SQL Editor");
    }
    throw new Error(msg);
  }
  const jobId = inserted.id as string;

  try {
    const plan = await generateBragPlan({
      tone: tone as BragTonePreset,
      format,
      title: params.title,
      creativeDirection: params.creativeDirection,
    });

    const jobDir = await writeJobWorkspace(jobId, plan, format);
    await writeFile(path.join(jobDir, "share-copy.txt"), plan.share_copy, "utf8");

    const canRender = await canRenderVideo();

    if (!canRender) {
      const hint = isVercelServerless()
        ? "Plan ready (stored in DB). MP4 render needs a local machine with FFmpeg: npm run brag:render -- " + jobId
        : "Plan + composition saved. FFmpeg/Hyperframes render unavailable on this host — run: npm run brag:render -- " +
          jobId;
      const { data: updated } = await admin
        .from("brag_jobs")
        .update({
          status: "plan_ready",
          plan_json: plan,
          share_copy: plan.share_copy,
          duration_sec: plan.total_duration_sec,
          finished_at: new Date().toISOString(),
          error_text: hint,
        })
        .eq("id", jobId)
        .select("*")
        .single();
      return updated as BragJobRow;
    }

    await admin.from("brag_jobs").update({ status: "rendering" }).eq("id", jobId);

    const mp4 = await renderHyperframes(jobDir);
    const videoPath = await publishVideo(jobId, mp4);

    const { data: done } = await admin
      .from("brag_jobs")
      .update({
        status: "ready",
        plan_json: plan,
        share_copy: plan.share_copy,
        video_path: videoPath,
        duration_sec: plan.total_duration_sec,
        finished_at: new Date().toISOString(),
        error_text: null,
      })
      .eq("id", jobId)
      .select("*")
      .single();

    return done as BragJobRow;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin
      .from("brag_jobs")
      .update({ status: "failed", error_text: msg, finished_at: new Date().toISOString() })
      .eq("id", jobId);
    throw e;
  }
}

export async function rerenderBragJob(jobId: string): Promise<BragJobRow> {
  const admin = getAdmin();
  if (!(await ffmpegAvailable())) throw new Error("FFmpeg not available on this host");

  const { data: row, error: fetchErr } = await admin.from("brag_jobs").select("*").eq("id", jobId).single();
  if (fetchErr || !row) throw new Error(fetchErr?.message ?? "job_not_found");

  await admin.from("brag_jobs").update({ status: "rendering", error_text: null }).eq("id", jobId);

  try {
    const jobDir = await ensureJobWorkspace(row as BragJobRow);
    const mp4 = await renderHyperframes(jobDir);
    const videoPath = await publishVideo(jobId, mp4);
    const { data } = await admin
      .from("brag_jobs")
      .update({
        status: "ready",
        video_path: videoPath,
        finished_at: new Date().toISOString(),
        error_text: videoPath ? null : "Rendered locally — copy from var/brag-jobs/" + jobId + "/brag.mp4",
      })
      .eq("id", jobId)
      .select("*")
      .single();
    return data as BragJobRow;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin
      .from("brag_jobs")
      .update({ status: "failed", error_text: msg, finished_at: new Date().toISOString() })
      .eq("id", jobId);
    throw e;
  }
}
