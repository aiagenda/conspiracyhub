import { BRAG_FORMATS, type BragFormat } from "@/lib/server/bragProjectContext";

export type BragScene = {
  id: string;
  name: string;
  duration_sec: number;
  headline: string;
  subline?: string;
  detail?: string;
};

export type BragPlanPayload = {
  product_name: string;
  hook: string;
  angle: string;
  share_copy: string;
  scenes: BragScene[];
  total_duration_sec: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build a Hyperframes-ready index.html from a structured brag plan. */
export function buildBragCompositionHtml(plan: BragPlanPayload, format: BragFormat): string {
  const { width, height } = BRAG_FORMATS[format];
  const totalDuration = plan.scenes.reduce((s, sc) => s + sc.duration_sec, 0) || plan.total_duration_sec || 20;

  let cursor = 0;
  const sceneBlocks: string[] = [];
  const tweenLines: string[] = [];

  for (const scene of plan.scenes) {
    const start = cursor;
    const dur = scene.duration_sec;
    cursor += dur;
    const id = scene.id.replace(/[^a-z0-9-]/gi, "-").toLowerCase();

    sceneBlocks.push(`
      <div id="${id}" class="clip scene" data-start="${start}" data-duration="${dur}" data-track-index="1"
           style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:80px;text-align:center;opacity:0;">
        <div class="scanline-overlay"></div>
        <div class="scene-label">${escapeHtml(scene.name.toUpperCase())}</div>
        <h1 class="headline">${escapeHtml(scene.headline)}</h1>
        ${scene.subline ? `<p class="subline">${escapeHtml(scene.subline)}</p>` : ""}
        ${scene.detail ? `<p class="detail">${escapeHtml(scene.detail)}</p>` : ""}
      </div>`);

    tweenLines.push(`      tl.fromTo("#${id}", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" }, ${start});`);
    tweenLines.push(`      tl.to("#${id}", { opacity: 0, y: -16, duration: 0.4, ease: "power2.in" }, ${start + dur - 0.45});`);
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${width}, height=${height}" />
  <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: #050c07; }
    body { font-family: "Share Tech Mono", monospace; color: #c8e8d0; }
    .scanline-overlay {
      pointer-events: none; position: absolute; inset: 0; opacity: 0.08;
      background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.15) 2px, rgba(0,255,136,0.15) 4px);
    }
    .scene-label { font-family: "Rajdhani", sans-serif; font-size: ${format === "vertical" ? 22 : 18}px; letter-spacing: 6px; color: #5a8068; margin-bottom: 24px; }
    .headline {
      font-family: "Rajdhani", sans-serif; font-weight: 700; color: #00ff88;
      font-size: ${format === "vertical" ? 72 : 88}px; line-height: 1.05; max-width: 90%;
      text-shadow: 0 0 40px rgba(0,255,136,0.25);
    }
    .subline { margin-top: 28px; font-size: ${format === "vertical" ? 28 : 32}px; color: #c8e8d0; max-width: 85%; line-height: 1.4; }
    .detail { margin-top: 20px; font-size: ${format === "vertical" ? 22 : 24}px; color: #7aaa8a; max-width: 80%; line-height: 1.5; }
    .logo-bar {
      position: absolute; bottom: 48px; left: 0; right: 0; text-align: center;
      font-family: "Rajdhani", sans-serif; font-size: 22px; letter-spacing: 4px; color: #5a8068;
    }
  </style>
</head>
<body>
  <div id="root" data-composition-id="the-theorist-brag" data-start="0" data-duration="${totalDuration}"
       data-width="${width}" data-height="${height}" style="position:relative;width:${width}px;height:${height}px;background:#050c07;">
    ${sceneBlocks.join("\n")}
    <div class="logo-bar">◈ THE THEORIST · the-theorist.com</div>
  </div>
  <audio id="bgm" data-start="0" data-duration="${totalDuration}" data-track-index="2" data-volume="0.35"
         src="assets/music/track.mp3"></audio>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
${tweenLines.join("\n")}
    window.__timelines["the-theorist-brag"] = tl;
  </script>
</body>
</html>`;
}

export function bragHyperframesJson() {
  return {
    $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
    registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
    paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
    media: { autoProxy: true },
  };
}

export function bragPackageJson(jobId: string) {
  return {
    name: `brag-${jobId.slice(0, 8)}`,
    private: true,
    type: "module",
    scripts: {
      dev: "npx --yes hyperframes@0.7.78 preview",
      render: "npx --yes hyperframes@0.7.78 render --output brag.mp4",
      lint: "npx --yes hyperframes@0.7.78 lint",
    },
  };
}
