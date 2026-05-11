/**
 * Unified typography + readable muted colors for /search.
 * Keep body text ≥12px; primary reading ≥14px.
 */
export const searchTypo = {
  heroTitle: 24,
  heroSub: 14,
  navBack: 13,
  tab: 14,
  input: 15,
  btn: 14,
  /** Align primary actions with search field */
  controlMinH: 50,
  filterPill: 12,
  sectionLabel: 12,
  cardTitle: 15,
  cardTitleAccent: 16,
  body: 14,
  bodyTight: 13,
  meta: 13,
  caption: 12,
  scoreMd: 22,
  scoreLg: 24,
  scoreHero: 26,
} as const;

export const searchColor = {
  text: "#c8e8d0",
  textBright: "#e8ffe8",
  /** Secondary text — brighter than legacy #5a8068 for contrast */
  muted: "#8ab89a",
  mutedStrong: "#9ec8ae",
  /** De-emphasized but still readable */
  dim: "#6a9078",
  faint: "#5a8068",
  scanLine: "#4a7058",
  patentBody: "#d4b8b8",
  patentMeta: "#c89898",
  peopleRole: "#8ab89a",
  urlTheorySummary: "#c4a8d4",
  urlInfo: "#9a8a58",
  urlExample: "#7a9a88",
  urlExampleHover: "#00bb66",
} as const;
