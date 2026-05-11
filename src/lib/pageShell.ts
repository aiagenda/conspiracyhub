import type { CSSProperties } from "react";

/** Main content column width — matches home feed. */
export const PAGE_CONTENT_MAX = 1520;

/** Standard horizontal + vertical padding for primary page shells. */
export const PAGE_CONTENT_PADDING = "1.75rem clamp(1rem, 3vw, 2rem) 4rem";

/** Primary page content wrapper (max width + centered + feed padding). */
export function pageContentShellStyle(extra?: CSSProperties): CSSProperties {
  return {
    maxWidth: PAGE_CONTENT_MAX,
    margin: "0 auto",
    padding: PAGE_CONTENT_PADDING,
    ...extra,
  };
}
