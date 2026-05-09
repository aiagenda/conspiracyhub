"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  /** Wider padding / gap on home feed header */
  spacious?: boolean;
};

export default function SiteNav({ spacious }: Props) {
  const pathname = usePathname() ?? "";
  const feedActive = pathname === "/";
  const searchActive = pathname === "/search";
  const outbreaksActive = pathname === "/outbreaks";

  const pad = spacious ? "6px 14px" : "5px 12px";
  const fontSize = spacious ? 11 : 10;

  function base() {
    return {
      fontFamily: "var(--font-raj), sans-serif",
      fontSize,
      fontWeight: 700 as const,
      letterSpacing: 2,
      textTransform: "uppercase" as const,
      padding: pad,
      borderRadius: 3,
      textDecoration: "none" as const,
      display: "inline-flex" as const,
      alignItems: "center" as const,
      gap: 6,
    };
  }

  return (
    <nav aria-label="Main" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <Link
        href="/"
        style={{
          ...base(),
          background: feedActive ? "rgba(0,255,136,0.08)" : "transparent",
          border: `1px solid ${feedActive ? "#00bb66" : "#1a3320"}`,
          color: feedActive ? "#00ff88" : "#5a8068",
        }}
        aria-current={feedActive ? "page" : undefined}
      >
        FEED
      </Link>
      <Link
        href="/search"
        style={{
          ...base(),
          background: searchActive ? "rgba(0,255,136,0.08)" : "transparent",
          border: `1px solid ${searchActive ? "#00bb66" : "#1a3320"}`,
          color: searchActive ? "#00ff88" : "#5a8068",
        }}
        aria-current={searchActive ? "page" : undefined}
      >
        SEARCH
      </Link>
      <Link
        href="/outbreaks"
        className="site-nav-outbreaks"
        data-active={outbreaksActive ? "true" : "false"}
        style={{
          ...base(),
          background: outbreaksActive ? "rgba(255,51,51,0.12)" : "rgba(255,51,51,0.08)",
          border: `1px solid ${outbreaksActive ? "#ff5555" : "#ff3333"}`,
          color: outbreaksActive ? "#ffaaaa" : "#ff3333",
          boxShadow: outbreaksActive ? "0 0 8px rgba(255,51,51,0.25)" : undefined,
        }}
        aria-current={outbreaksActive ? "page" : undefined}
      >
        <span className="site-nav-outbreaks-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff3333", display: "inline-block" }} aria-hidden />
        OUTBREAKS
      </Link>
    </nav>
  );
}
