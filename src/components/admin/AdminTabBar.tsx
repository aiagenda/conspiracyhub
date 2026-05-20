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

const tabBtn =
  "rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors";

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
      className="sticky top-0 z-20 -mx-1 flex flex-wrap gap-1.5 border-b pb-4"
      style={{ borderColor: "#1a2a22", background: "var(--background)" }}
      aria-label="Admin sections"
    >
      {ADMIN_TABS.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={tabBtn}
            style={{
              borderColor: on ? (t.accent ?? "var(--green-dark)") : "#1a2a22",
              background: on ? (t.accent ? "rgba(255,170,0,0.1)" : "rgba(0,187,102,0.1)") : "transparent",
              color: on ? (t.accent ?? "var(--green)") : muted,
            }}
          >
            {t.label}
            {t.id === "inbox" && inboxUnread > 0 ? (
              <span className="ml-1.5 rounded px-1.5 py-0.5 text-[9px]" style={{ background: "rgba(255,100,100,0.2)", color: "#ff8888" }}>
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

export function SectionHeading({ title, accent = "var(--green-dark)" }: { title: string; accent?: string }) {
  return (
    <h2
      className="font-raj mb-5 text-[13px] font-bold uppercase tracking-[0.18em]"
      style={{ color: "var(--foreground)", borderLeft: `2px solid ${accent}`, paddingLeft: 10 }}
    >
      {title}
    </h2>
  );
}
