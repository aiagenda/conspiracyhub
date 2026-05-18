import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapTitle(title: string, maxCharsPerLine = 42): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxCharsPerLine && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title")?.trim() || "The Theorist Investigation";
  const lines = wrapTitle(title);
  const startY = 220;
  const titleLines = lines
    .map((l, i) => `<tspan x="80" y="${startY + i * 52}">${escapeXml(l)}</tspan>`)
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#030a06"/>
      <stop offset="100%" style="stop-color:#0a1a10"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="4" fill="#00ff88" opacity="0.9"/>
  <text x="80" y="72" fill="#00ff88" font-family="system-ui, sans-serif" font-size="22" font-weight="700" letter-spacing="6">THE THEORIST</text>
  <text x="80" y="118" fill="#5a8068" font-family="system-ui, sans-serif" font-size="16" letter-spacing="3">INVESTIGATION REPORT</text>
  <text fill="#e8f5ec" font-family="system-ui, sans-serif" font-size="44" font-weight="700">${titleLines}</text>
  <text x="80" y="580" fill="#3a6040" font-family="monospace" font-size="14" letter-spacing="2">the-theorist.com · AI investigative intelligence</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
