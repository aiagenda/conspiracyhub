/**
 * The shell every message from the site is built in.
 *
 * Email is not the web: Gmail strips <style> blocks and classes, Outlook renders
 * through Word, and neither flexbox nor grid can be relied on — so this is
 * table-based with inline styles only, and the web fonts the site uses are
 * replaced by a monospace stack that is already installed everywhere.
 *
 * The mark is the glyph ◈ rather than the site's SVG, because Gmail does not
 * render inline SVG and a remote image is blocked until the reader allows it.
 */
const BG = "#050807";
const PANEL = "#080c09";
const LINE = "#1a2a22";
const INK = "#c8e8d0";
const MUTED = "#5a8068";
const ACCENT = "#00ff88";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

export type EmailButton = { label: string; href: string };

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A button that survives Outlook, which ignores padding on anchors. */
export function emailButton({ label, href }: EmailButton): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0">
    <tr><td align="center" bgcolor="${PANEL}" style="border:1px solid ${ACCENT};border-radius:2px">
      <a href="${escapeAttr(href)}" style="display:inline-block;padding:13px 26px;font-family:${MONO};font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${ACCENT};text-decoration:none">${label}&nbsp;&rarr;</a>
    </td></tr>
  </table>`;
}

export function emailShell(options: {
  /** The grey line the inbox shows beside the subject. */
  preheader: string;
  kicker: string;
  heading: string;
  /** Inner HTML — paragraphs and buttons built with the helpers here. */
  body: string;
  /** Small print under the rule; the unsubscribe link belongs here. */
  footnote?: string;
}): string {
  const { preheader, kicker, heading, body, footnote } = options;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background:${BG};margin:0;padding:0">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:${PANEL};border:1px solid ${LINE}">

      <tr><td style="padding:22px 28px;border-bottom:1px solid ${LINE}">
        <span style="font-family:${MONO};font-size:17px;font-weight:700;letter-spacing:.18em;color:${ACCENT}">&#9672; THE THEORIST</span><br>
        <span style="font-family:${MONO};font-size:10px;letter-spacing:.22em;color:${MUTED}">AI INVESTIGATIVE INTELLIGENCE</span>
      </td></tr>

      <tr><td style="padding:30px 28px 28px">
        <p style="margin:0 0 10px;font-family:${MONO};font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${ACCENT}">${kicker}</p>
        <h1 style="margin:0 0 18px;font-family:${MONO};font-size:22px;line-height:1.3;font-weight:700;color:#ffffff">${heading}</h1>
        ${body}
      </td></tr>

      ${footnote ? `<tr><td style="padding:18px 28px 22px;border-top:1px solid ${LINE}">
        <p style="margin:0;font-family:${MONO};font-size:11px;line-height:1.7;color:${MUTED}">${footnote}</p>
      </td></tr>` : ""}

    </table>
    <p style="margin:18px 0 0;font-family:${MONO};font-size:10px;letter-spacing:.1em;color:#2f4238">THE-THEORIST.COM</p>
  </td></tr>
</table>
</body></html>`;
}

/** Body copy inside the shell. */
export function emailParagraph(html: string, opts: { muted?: boolean } = {}): string {
  return `<p style="margin:0 0 14px;font-family:${MONO};font-size:14px;line-height:1.75;color:${opts.muted ? MUTED : INK}">${html}</p>`;
}

/** The same message as plain text, which helps a mail reach the inbox at all. */
export function emailPlainText(lines: string[]): string {
  return [`◈ THE THEORIST`, `AI INVESTIGATIVE INTELLIGENCE`, "", ...lines, "", "the-theorist.com"].join("\n");
}

export const emailColors = { BG, PANEL, LINE, INK, MUTED, ACCENT, MONO };
