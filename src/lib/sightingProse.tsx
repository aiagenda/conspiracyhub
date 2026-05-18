import type { CSSProperties } from "react";
import { parseBriefBullets } from "@/lib/sightingBrief";

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

export type SectionBlock =
  | { kind: "intro"; lines: string[] }
  | { kind: "section"; heading: string; lines: string[] };

/** Insert newlines before embedded "Month YYYY —" headings in long paragraphs. */
export function normalizeDigestText(text: string): string {
  let t = text.replace(/\r\n/g, "\n");
  t = t.replace(
    new RegExp(`([.!?])\\s+(${MONTHS})\\s+(\\d{4})\\s*([-–—:])`, "gi"),
    "$1\n$2 $3 $4",
  );
  t = t.replace(
    new RegExp(`\\s+(${MONTHS})\\s+(\\d{4})\\s*([-–—:])`, "gi"),
    "\n$1 $2 $3",
  );
  return t;
}

export function looksLikeCaseDigest(text: string): boolean {
  const t = normalizeDigestText(text).trim();
  if (t.length < 120) return false;
  const hits = t.match(new RegExp(`(?:^|\\n)${MONTHS}\\s+\\d{4}\\s*[-–—:]`, "gi"));
  if (hits && hits.length >= 2) return true;
  if (hits && hits.length >= 1 && /FULL\s+REPORT/i.test(t)) return true;
  return false;
}

export function parseCaseDigest(text: string): DigestBlock[] {
  const normalized = normalizeDigestText(text);
  const lines = normalized.split("\n").map((l) => l.trim());
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

function isSectionHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 90) return false;
  if (/[.!?]$/.test(t) && t.length > 50) return false;
  if (CASE_HEADING_RE.test(t)) return false;
  if (/^FULL\s+REPORT$/i.test(t)) return false;
  if (/^[-•*]\s/.test(t)) return false;
  if (/^[A-Z0-9][A-Z0-9\s/&,'()-]{8,}$/.test(t) && /[A-Z]{2,}/.test(t)) return true;
  if (
    t.length < 70 &&
    /^[A-Z][a-z]+(\s+(?:[A-Z][a-z]+|and|of|the|in|on|for|to|&))+/.test(t) &&
    !t.includes(". ")
  ) {
    return true;
  }
  if (t.length < 75 && /:\s*$/.test(t)) return true;
  return false;
}

export function parseBlogSections(text: string): SectionBlock[] | null {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim());
  const blocks: SectionBlock[] = [];
  let intro: string[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  let sectionCount = 0;

  const flush = () => {
    if (!current) return;
    const body = current.lines.filter(Boolean);
    if (current.heading || body.length) {
      blocks.push({ kind: "section", heading: current.heading, lines: body });
      sectionCount++;
    }
    current = null;
  };

  for (const line of lines) {
    if (!line) {
      if (current) current.lines.push("");
      continue;
    }
    if (isSectionHeading(line)) {
      flush();
      if (intro.length) {
        blocks.push({ kind: "intro", lines: intro.filter(Boolean) });
        intro = [];
      }
      current = {
        heading: line.replace(/:\s*$/, "").trim(),
        lines: [],
      };
      continue;
    }
    if (current) current.lines.push(line);
    else intro.push(line);
  }
  flush();
  if (intro.length) blocks.unshift({ kind: "intro", lines: intro.filter(Boolean) });

  if (sectionCount < 2) return null;
  if (blocks.length === 0) return null;
  return blocks;
}

export function shouldUseDigestLayout(
  text: string,
  contentKind?: SightingContentKind,
): boolean {
  return contentKind === "case" || looksLikeCaseDigest(text);
}

export function shouldUseBlogSections(
  text: string,
  contentKind?: SightingContentKind,
): boolean {
  if (contentKind !== "blog") return false;
  if (looksLikeCaseDigest(text)) return false;
  return parseBlogSections(text) !== null;
}

const bodyStyle: CSSProperties = {
  fontFamily: "var(--font-raj), sans-serif",
  fontSize: 15,
  color: "#c8e8d0",
  lineHeight: 1.75,
  wordBreak: "break-word",
};

function ProseLines({ lines, size = 15 }: { lines: string[]; size?: number }) {
  return (
    <>
      {lines.map((line, j) => {
        if (!line.trim()) return <div key={j} style={{ height: 8 }} />;
        return (
          <p
            key={j}
            style={{
              ...bodyStyle,
              fontSize: size,
              margin: "0 0 0.65em 0",
              color: "#b8dcc8",
            }}
          >
            {line}
          </p>
        );
      })}
    </>
  );
}

function FullReportLink({
  line,
  sourceUrl,
}: {
  line: string;
  sourceUrl?: string | null;
}) {
  if (!FULL_REPORT_RE.test(line.trim()) || !sourceUrl) return null;
  return (
    <a
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

export function SightingBriefBullets({
  brief,
  accent = "#ffcc00",
}: {
  brief: string;
  accent?: string;
}) {
  const bullets = parseBriefBullets(brief);
  if (bullets.length === 0) return null;
  return (
    <div
      style={{
        marginBottom: 16,
        padding: "14px 16px",
        border: `1px solid ${accent}44`,
        borderRadius: 4,
        background: "rgba(255,204,0,0.04)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-share-tech-mono), monospace",
          fontSize: 9,
          letterSpacing: 2,
          color: accent,
          marginBottom: 10,
        }}
      >
        ◈ INTELLIGENCE BRIEF
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: "1.15em",
          ...bodyStyle,
          fontSize: 14,
        }}
      >
        {bullets.map((b, i) => (
          <li key={i} style={{ marginBottom: "0.55em" }}>
            {b}
          </li>
        ))}
      </ul>
      <p
        style={{
          margin: "10px 0 0",
          fontFamily: "var(--font-share-tech-mono), monospace",
          fontSize: 9,
          color: "#5a8068",
          letterSpacing: 0.5,
          lineHeight: 1.5,
        }}
      >
        Site summary — not a substitute for the NUFORC source. Use SOURCE or full text below.
      </p>
    </div>
  );
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

  return (
    <div style={{ maxWidth: "42rem" }}>
      {blocks.map((block, i) => {
        if (block.kind === "intro") {
          return (
            <div key={`intro-${i}`} style={{ ...bodyStyle, color: "#b8dcc8", marginBottom: 20 }}>
              <ProseLines lines={block.lines} />
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
                return <FullReportLink key={j} line={line} sourceUrl={sourceUrl} />;
              }
              if (!line.trim()) return <div key={j} style={{ height: 8 }} />;
              return (
                <p
                  key={j}
                  style={{
                    ...bodyStyle,
                    fontSize: 14,
                    margin: "0 0 0.65em 0",
                    color: "#b8dcc8",
                  }}
                >
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

export function SightingBlogProse({
  text,
  accent = "#00bb66",
}: {
  text: string;
  accent?: string;
}) {
  const blocks = parseBlogSections(text);
  if (!blocks) return null;

  return (
    <div style={{ maxWidth: "42rem" }}>
      {blocks.map((block, i) => {
        if (block.kind === "intro") {
          return (
            <div key={`intro-${i}`} style={{ ...bodyStyle, marginBottom: 20 }}>
              <ProseLines lines={block.lines} />
            </div>
          );
        }
        return (
          <section
            key={`sec-${i}`}
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              border: `1px solid ${accent}33`,
              borderRadius: 4,
              background: "rgba(0,255,136,0.02)",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-raj), sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "#c8e8d0",
                margin: "0 0 10px 0",
                lineHeight: 1.35,
                letterSpacing: 0.5,
              }}
            >
              {block.heading}
            </h3>
            <ProseLines lines={block.lines} size={14} />
          </section>
        );
      })}
    </div>
  );
}

export function SightingRichBody({
  text,
  contentKind,
  sourceUrl,
  accent = "#ffcc00",
}: {
  text: string;
  contentKind?: SightingContentKind;
  sourceUrl?: string | null;
  accent?: string;
}) {
  if (shouldUseDigestLayout(text, contentKind)) {
    return <SightingBodyProse text={text} sourceUrl={sourceUrl} accent={accent} />;
  }
  if (shouldUseBlogSections(text, contentKind)) {
    return <SightingBlogProse text={text} accent="#00bb66" />;
  }
  return null;
}
