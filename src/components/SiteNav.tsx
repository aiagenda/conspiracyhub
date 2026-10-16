"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUser, signOut } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase";
import AuthModal from "@/components/AuthModal";
import type { User } from "@supabase/supabase-js";
import { isBillingEnabled } from "@/lib/featureFlags";
type Props = { spacious?: boolean; user?: User | null; userPlan?: string | null; onSignIn?: () => void; onUpgrade?: () => void; onSignedOut?: () => void };
const NAV_LINKS = [
  { href: "/", label: "Feed", tone: "green" },
  { href: "/uap", label: "UAP Files", tone: "blue" },
  { href: "/outbreaks", label: "Outbreaks", tone: "red" },
  { href: "/seismic", label: "Seismic", tone: "orange" },
  { href: "/insider-radar", label: "Insider Radar", tone: "amber" },
  { href: "/blog", label: "Analysis", tone: "purple" },
  { href: "/ai", label: "AI & Tech", tone: "cyan" },
  { href: "/toolkit", label: "Toolkit", tone: "green" },
  { href: "/topics", label: "Topics", tone: "green" },
  { href: "/search", label: "Search", tone: "green" },
  { href: "/guide", label: "Guide", tone: "green" },
];
export default function SiteNav({ user: userProp, userPlan, onSignIn, onUpgrade, onSignedOut }: Props) {
  const pathname = usePathname() ?? "";
  const controlled = userProp !== undefined;
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [menuTop, setMenuTop] = useState(64);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const user = controlled ? (userProp ?? null) : localUser;
  const refresh = useCallback(() => { if (!controlled) void getCurrentUser().then(setLocalUser).catch(() => {}); }, [controlled]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (controlled || !isSupabaseBrowserConfigured()) return;
    const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => setLocalUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, [controlled]);
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
  function signIn() { setMenuOpen(false); if (onSignIn) onSignIn(); else setAuthOpen(true); }
  async function leave() {
    setSigningOut(true);
    try { await signOut(); if (controlled) onSignedOut?.(); else setLocalUser(null); setMenuOpen(false); }
    finally { setSigningOut(false); }
  }
  const active = (href: string) => href === "/" ? pathname === "/" || pathname.startsWith("/article/") : pathname === href || pathname.startsWith(href + "/");
  const links = NAV_LINKS.map(({ href, label, tone }) => <Link key={href} href={href} data-tone={tone} aria-current={active(href) ? "page" : undefined} onClick={() => setMenuOpen(false)}>{label}</Link>);
  const account = user ? <><Link href="/account" onClick={() => setMenuOpen(false)}>Account</Link><button type="button" disabled={signingOut} onClick={() => void leave()}>{signingOut ? "Signing out…" : "Sign out"}</button></> : <button type="button" onClick={signIn}>Sign in</button>;
  const upgrade = isBillingEnabled() && userPlan?.toLowerCase() !== "pro" ? onUpgrade ? <button type="button" onClick={onUpgrade}>Upgrade</button> : <Link href="/account">Upgrade</Link> : null;
  return <>
    <nav className="publication-nav publication-nav-desktop" aria-label="Main navigation">{links}<span className="publication-nav-account">{account}{upgrade}</span></nav>
    <button ref={menuBtn} className="publication-menu-button" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="publication-mobile-menu" onClick={() => { if (!menuOpen) setMenuTop(menuBtn.current?.getBoundingClientRect().bottom ?? 64); setMenuOpen(!menuOpen); }}>{menuOpen ? "Close" : "Menu"}<span aria-hidden="true">{menuOpen ? "×" : "☰"}</span></button>
    {menuOpen ? <><div className="publication-menu-backdrop" style={{ top: menuTop }} onClick={() => setMenuOpen(false)} aria-hidden="true" /><div ref={menu} id="publication-mobile-menu" className="publication-mobile-menu" style={{ top: menuTop, maxHeight: `calc(100dvh - ${menuTop}px)` }}><nav aria-label="Mobile main navigation">{links}{account}{upgrade}</nav></div></> : null}
    {authOpen ? <AuthModal onClose={() => { setAuthOpen(false); refresh(); }} /> : null}
  </>;
}
