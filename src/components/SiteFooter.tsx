"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/faq",     label: "FAQ" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms",   label: "Terms of Service" },
  { href: "/contact", label: "Contact" },
];

/** Pages where we suppress the footer entirely */
const SUPPRESS_PATHS = ["/admin"];

export default function SiteFooter() {
  const pathname = usePathname() ?? "";

  if (SUPPRESS_PATHS.some((p) => pathname.startsWith(p))) return null;

  return (
    <footer
      style={{
        borderTop: "1px solid #111",
        padding: "28px clamp(1rem, 3vw, 2rem)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        fontSize: 11,
        letterSpacing: "0.05em",
      }}
    >
      <span style={{ color: "#333", textTransform: "uppercase" }}>
        © {new Date().getFullYear()} ConspiracyHub — All rights reserved
      </span>
      <nav style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            style={{
              color: pathname === l.href ? "#6bc46b" : "#444",
              textDecoration: "none",
              textTransform: "uppercase",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.color = "#6bc46b"; }}
            onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.color = pathname === l.href ? "#6bc46b" : "#444"; }}
          >
            {l.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
