"use client";

import {
  ADMIN_TABS,
  AUTOMATION_SUBTABS,
  CONTENT_SUBTABS,
  type AdminTab,
  type AutomationSubTab,
  type ContentSubTab,
  muted,
} from "@/components/admin/constants";

const subTabBtn =
  "rounded border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors";

export function AdminTabBar({
  active,
  onChange,
  inboxUnread = 0,
}: {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
  inboxUnread?: number;
}) {
  return (
    <nav
      className="sticky top-0 z-20 flex flex-wrap gap-1 rounded-2xl border p-1"
      style={{ borderColor: "#1a2a22", background: "#080c09" }}
      aria-label="Admin sections"
    >
      {ADMIN_TABS.map((t) => {
        const on = active === t.id;
        const accent = t.accent ?? "var(--green)";
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="rounded-xl px-4 py-2.5 text-[12px] font-semibold tracking-wide transition-colors"
            style={{
              background: on ? "rgba(125,255,179,0.08)" : "transparent",
              color: on ? accent : muted,
              boxShadow: on ? `inset 0 0 0 1px ${accent}` : "none",
            }}
          >
            {t.label}
            {t.id === "inbox" && inboxUnread > 0 ? (
              <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: "rgba(255,100,100,0.2)", color: "#ff8888" }}>
                {inboxUnread}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export function ContentSubTabBar({
  active,
  onChange,
}: {
  active: ContentSubTab;
  onChange: (tab: ContentSubTab) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Content views">
      {CONTENT_SUBTABS.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={subTabBtn}
            style={{
              borderColor: on ? (t.id === "twitter" ? "#ffaa00" : "var(--green-dark)") : "#1a2a22",
              background: on ? (t.id === "twitter" ? "rgba(255,170,0,0.1)" : "rgba(0,187,102,0.08)") : "transparent",
              color: on ? (t.id === "twitter" ? "#ffaa00" : "var(--green)") : muted,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function AutomationSubTabBar({
  active,
  onChange,
}: {
  active: AutomationSubTab;
  onChange: (tab: AutomationSubTab) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Automation views">
      {AUTOMATION_SUBTABS.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={subTabBtn}
            style={{
              borderColor: on ? "var(--green-dark)" : "#1a2a22",
              background: on ? "rgba(0,187,102,0.08)" : "transparent",
              color: on ? "var(--green)" : muted,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionHeading({ title, accent = "#7dffb3" }: { title: string; accent?: string }) {
  return (
    <h2 className="font-raj mb-5 text-2xl font-bold tracking-tight" style={{ color: accent === "#ffaa00" ? "#ffaa00" : "var(--foreground)" }}>
      {title}
    </h2>
  );
}
