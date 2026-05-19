"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/faq",     label: "FAQ" },
  { href: "/guide",   label: "Guide" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms",   label: "Terms" },
  { href: "/contact", label: "Contact" },
];

/** Pages where we suppress the footer entirely */
const SUPPRESS_PATHS = ["/admin"];

export default function SiteFooter() {
  const pathname = usePathname() ?? "";

  if (SUPPRESS_PATHS.some((p) => pathname.startsWith(p))) return null;

  return (
    <footer
      className="site-footer"
      style={{
        borderTop: "1px solid #1a3320",
        padding: "20px clamp(1rem, 3vw, 2rem)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        background: "#050c07",
        fontFamily: "var(--font-raj), sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="site-footer-meta" style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase" }}>
          ■ THE THEORIST
        </span>
        <span style={{ width: 1, height: 12, background: "#1a3320", display: "inline-block" }} />
        <span className="site-footer-meta" style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>
          © {new Date().getFullYear()} · AI INVESTIGATIVE INTELLIGENCE
        </span>
      </div>
      <nav style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            style={{
              fontFamily: "var(--font-raj), sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: pathname === l.href ? "#00bb66" : "var(--muted-dim, #7aaa8a)",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#00bb66"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = pathname === l.href ? "#00bb66" : "var(--muted-dim, #7aaa8a)"; }}
          >
            {l.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
