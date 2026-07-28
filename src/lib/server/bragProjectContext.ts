/** Product context fed into Brag plan generation for The Theorist. */

export const THE_THEORIST_BRAG_CONTEXT = `
Product: The Theorist (the-theorist.com) — conspiracy intelligence platform.
Tagline energy: "Priority-scored news. Oracle investigation boards. Declassified deep-dives."

Core features to show in a launch video:
1. FEED — AI priority-scored news stream (Guardian, GNews, Reddit, FOIA). Threat scores 0–100%.
2. ORACLE / INVESTIGATION BOARD — GPT-4o graph per story: actors, theories, verdict, interactive board at /board/[id].
3. ANALYSIS REPORTS — Long-form AI investigative articles at /blog (SEO deep-dives, FAQ schema).
4. UAP FILES — Documented sighting archive at /uap.
5. OUTBREAK TRACKER — Health intelligence at /outbreaks.
6. INSIDER RADAR — Live X/Twitter feed from UAP researchers at /insider-radar.

Visual identity:
- Background: #050c07 (terminal green-black)
- Primary accent: #00ff88
- Secondary text: #c8e8d0 / muted #5a8068
- Fonts: Rajdhani (headlines), Share Tech Mono (body) — terminal / intelligence aesthetic
- Scanline overlay, ◈ diamond motif, "CLASSIFIED" energy without being cheesy

Audience: conspiracy-curious, OSINT, UAP, declassified docs, investigative journalism.
Tone of product: serious investigative tool with dark-green terminal UI — not cartoonish.

Do NOT use generic SaaS copy ("streamline workflow", "boost productivity").
Use specific product language: Oracle, threat score, investigation board, declassified, priority signal.
`.trim();

export const BRAG_TONE_PRESETS = [
  "default",
  "polished",
  "yc-parody",
  "chaotic",
  "deadpan",
  "cinematic",
  "app-store",
] as const;

export type BragTonePreset = (typeof BRAG_TONE_PRESETS)[number];

export const BRAG_FORMATS = {
  landscape: { width: 1920, height: 1080, label: "Landscape (16:9)" },
  vertical: { width: 1080, height: 1920, label: "Vertical (9:16)" },
  square: { width: 1080, height: 1080, label: "Square (1:1)" },
} as const;

export type BragFormat = keyof typeof BRAG_FORMATS;
