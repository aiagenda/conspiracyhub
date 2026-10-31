"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The site asks nothing of its readers, so the nav offers nothing to sign into.
 * Auth itself is still there — the admin desk runs on it and /account is still
 * reachable by URL — it simply is not a thing the public is prompted with.
 */
type Props = { spacious?: boolean };
const NAV_LINKS = [
  { href: "/", label: "Feed", tone: "green" },
  { href: "/uap", label: "UAP Files", tone: "blue" },
  { href: "/outbreaks", label: "Outbreaks", tone: "red" },
  { href: "/seismic", label: "Seismic", tone: "orange" },
  { href: "/insider-radar", label: "Insider Radar", tone: "amber" },
  { href: "/blog", label: "Analysis", tone: "purple" },
  { href: "/ai", label: "AI & Tech", tone: "cyan" },
  { href: "/documents", label: "Declassified", tone: "amber" },
  { href: "/toolkit", label: "Toolkit", tone: "green" },
  { href: "/topics", label: "Topics", tone: "green" },
  { href: "/search", label: "Search", tone: "green" },
  { href: "/guide", label: "Guide", tone: "green" },
];
export default function SiteNav({}: Props) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTop, setMenuTop] = useState(64);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menu.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuBtn.current?.focus(); }
      if (event.key !== "Tab" || !menu.current) return;
      const controls = Array.from(menu.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"));
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);
  const active = (href: string) => href === "/" ? pathname === "/" || pathname.startsWith("/article/") : pathname === href || pathname.startsWith(href + "/");
  const links = NAV_LINKS.map(({ href, label, tone }) => <Link key={href} href={href} data-tone={tone} aria-current={active(href) ? "page" : undefined} onClick={() => setMenuOpen(false)}>{label}</Link>);
  return <>
    <nav className="publication-nav publication-nav-desktop" aria-label="Main navigation">{links}</nav>
    <button ref={menuBtn} className="publication-menu-button" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="publication-mobile-menu" onClick={() => { if (!menuOpen) setMenuTop(menuBtn.current?.getBoundingClientRect().bottom ?? 64); setMenuOpen(!menuOpen); }}>{menuOpen ? "Close" : "Menu"}<span aria-hidden="true">{menuOpen ? "×" : "☰"}</span></button>
    {menuOpen ? <><div className="publication-menu-backdrop" style={{ top: menuTop }} onClick={() => setMenuOpen(false)} aria-hidden="true" /><div ref={menu} id="publication-mobile-menu" className="publication-mobile-menu" style={{ top: menuTop, maxHeight: `calc(100dvh - ${menuTop}px)` }}><nav aria-label="Mobile main navigation">{links}</nav></div></> : null}
  </>;
}
