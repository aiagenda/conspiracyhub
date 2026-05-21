export const ADMIN_LIST_LIMIT = 10;

export const border = "1px solid #1a2a22";
export const cardBg = "#080c09";
export const muted = "#5a8068";

export type AdminTab = "dashboard" | "audience" | "content" | "automation" | "inbox";
export type ContentSubTab = "articles" | "blog" | "twitter" | "reddit";
export type AutomationSubTab = "ingest" | "seo" | "writers" | "lore";

export const ADMIN_TABS: { id: AdminTab; label: string; accent?: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "audience", label: "Audience" },
  { id: "content", label: "Content", accent: "#ffaa00" },
  { id: "automation", label: "Automation" },
  { id: "inbox", label: "Inbox" },
];

export const CONTENT_SUBTABS: { id: ContentSubTab; label: string }[] = [
  { id: "articles", label: "Feed articles" },
  { id: "blog", label: "Blog reports" },
  { id: "twitter", label: "X Drafts" },
  { id: "reddit", label: "Reddit Radar" },
];

export const AUTOMATION_SUBTABS: { id: AutomationSubTab; label: string }[] = [
  { id: "ingest", label: "Ingest & intel" },
  { id: "seo", label: "SEO / GSC" },
  { id: "writers", label: "Writers" },
  { id: "lore", label: "Lore dossier" },
];
