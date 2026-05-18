import type { CSSProperties } from "react";

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const CASE_HEADING_RE = new RegExp(
  `^(${MONTHS})\\s+(\\d{4})\\s*[-–—:]\\s*(.+)$`,
  "i",
);
const FULL_REPORT_RE = /^FULL\s+REPORT\s*$/i;

export type SightingContentKind = "report" | "blog" | "case";

export type DigestBlock =
  | { kind: "intro"; lines: string[] }
  | { kind: "case"; heading: string; lines: string[] };

export function looksLikeCaseDigest(text: string): boolean {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (t.length < 120) return false;
  const hits = t.match(new RegExp(`(?:^|\\n)${MONTHS}\\s+\\d{4}\\s*[-–—:]`, "gi"));
  if (hits && hits.length >= 2) return true;
  if (hits && hits.length >= 1 && /FULL\s+REPORT/i.test(t)) return true;
  return false;
}

export function parseCaseDigest(text: string): DigestBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim());
  const blocks: DigestBlock[] = [];
  let intro: string[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  const flushCase = () => {
    if (!current) return;
    const body = current.lines.filter((l) => l && !FULL_REPORT_RE.test(l));
    if (current.heading || body.length) {
      blocks.push({ kind: "case", heading: current.heading, lines: body });
    }
    current = null;
  };

  for (const line of lines) {
    if (!line) {
      if (current) current.lines.push("");
      else if (intro.length) intro.push("");
      continue;
    }
    const m = line.match(CASE_HEADING_RE);
    if (m) {
      flushCase();
      if (intro.length) {
        blocks.push({ kind: "intro", lines: intro.filter(Boolean) });
        intro = [];
      }
      current = {
        heading: `${m[1]} ${m[2]} — ${m[3].trim()}`,
        lines: [],
      };
      continue;
    }
    if (current) current.lines.push(line);
    else intro.push(line);
  }
  flushCase();
  if (intro.length) blocks.unshift({ kind: "intro", lines: intro.filter(Boolean) });
  if (blocks.length === 0) {
    return [{ kind: "intro", lines: [text.trim()] }];
  }
  return blocks;
}

export function shouldUseDigestLayout(
  text: string,
  contentKind?: SightingContentKind,
): boolean {
  return contentKind === "case" || contentKind === "blog" || looksLikeCaseDigest(text);
}

export function SightingBodyProse({
  text,
  sourceUrl,
  accent = "#ffcc00",
}: {
  text: string;
  sourceUrl?: string | null;
  accent?: string;
}) {
  const blocks = parseCaseDigest(text);
  const bodyStyle: CSSProperties = {
    fontFamily: "var(--font-raj), sans-serif",
    fontSize: 15,
    color: "#c8e8d0",
    lineHeight: 1.75,
    wordBreak: "break-word",
  };

  return (
    <div style={{ maxWidth: "42rem" }}>
      {blocks.map((block, i) => {
        if (block.kind === "intro") {
          return (
            <div key={`intro-${i}`} style={{ ...bodyStyle, color: "#b8dcc8", marginBottom: 20 }}>
              {block.lines.map((line, j) => (
                <p key={j} style={{ margin: j === block.lines.length - 1 ? 0 : "0 0 0.85em 0" }}>
                  {line}
                </p>
              ))}
            </div>
          );
        }
        return (
          <article
            key={`case-${i}`}
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              border: `1px solid ${accent}33`,
              borderRadius: 4,
              background: "rgba(255,204,0,0.03)",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-raj), sans-serif",
                fontSize: 14,
                fontWeight: 700,
                color: "#ffe8a0",
                margin: "0 0 10px 0",
                lineHeight: 1.35,
              }}
            >
              ◆ {block.heading}
            </h3>
            {block.lines.map((line, j) => {
              if (FULL_REPORT_RE.test(line.trim())) {
                if (!sourceUrl) return null;
                return (
                  <a
                    key={`fr-${j}`}
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      fontFamily: "var(--font-share-tech-mono), monospace",
                      fontSize: 11,
                      letterSpacing: 1,
                      color: "#00bb66",
                      textDecoration: "none",
                      border: "1px solid rgba(0,187,102,0.45)",
                      padding: "5px 12px",
                      borderRadius: 3,
                    }}
                  >
                    FULL REPORT ↗
                  </a>
                );
              }
              if (!line.trim()) return <div key={j} style={{ height: 8 }} />;
              return (
                <p key={j} style={{ ...bodyStyle, fontSize: 14, margin: "0 0 0.65em 0", color: "#b8dcc8" }}>
                  {line}
                </p>
              );
            })}
          </article>
        );
      })}
    </div>
  );
}
