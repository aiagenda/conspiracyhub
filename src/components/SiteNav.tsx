"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUser, signOut } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";
import { SHOW_COMMUNITY, isBillingEnabled } from "@/lib/featureFlags";

const RAJ = "var(--font-raj), sans-serif";

type Props = {
  spacious?: boolean;
  /** When passed (including `null`), nav auth UI follows this value; parent should refresh after sign-out. */
  user?: User | null;
  userPlan?: string | null;
  onSignIn?: () => void;
  onUpgrade?: () => void;
  /** Called after sign-out when `user` prop is controlled (e.g. feed re-fetches session). */
  onSignedOut?: () => void;
};

const NAV_LINKS = [
  { href: "/", label: "FEED", color: "#00ff88" },
  { href: "/uap", label: "UAP FILES", color: "#8aa6ff" },
  { href: "/outbreaks", label: "OUTBREAKS", color: "#ff3333", blink: true },
  { href: "/insider-radar", label: "INSIDER RADAR", color: "#ffaa00" },
  ...(SHOW_COMMUNITY ? [{ href: "/community", label: "COMMUNITY", color: "#00bb66" }] : []),
  { href: "/blog", label: "ANALYSIS", color: "#c94dff" },
  { href: "/search", label: "SEARCH", color: "#9ec8ae" },
  { href: "/guide", label: "GUIDE", color: "#9ec8ae" },
];

const MUTED_UI = "var(--muted, #7aaa8a)";

export default function SiteNav({ spacious, user: userProp, userPlan, onSignIn, onUpgrade, onSignedOut }: Props) {
  const pathname = usePathname() ?? "";
  const controlled = userProp !== undefined;
  const [uncontrolledUser, setUncontrolledUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  /** Top offset for the mobile dropdown — measured from the hamburger button so it
   * tracks the real header height instead of a hardcoded value. */
  const [menuTop, setMenuTop] = useState(52);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const user = controlled ? (userProp ?? null) : uncontrolledUser;

  const openMenu = useCallback(() => {
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (rect) setMenuTop(Math.round(rect.bottom));
    setMenuOpen(true);
  }, []);

  // Lock body scroll, close on Escape, and trap focus while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the menu for keyboard + screen-reader users.
    const firstLink = menuRef.current?.querySelector<HTMLElement>("a, button");
    firstLink?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !menuRef.current) return;
      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (controlled) return;
    void getCurrentUser().then(setUncontrolledUser);
  }, [controlled]);

  function afterSignOut() {
    if (controlled) onSignedOut?.();
    else setUncontrolledUser(null);
  }

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Desktop nav */}
      <nav aria-label="Main" className="desktop-nav" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {NAV_LINKS.map(({ href, label, color, blink }) => (
          <Link key={href} href={href}
            style={{
              fontFamily: RAJ, fontSize: spacious ? 13 : 11, fontWeight: 700,
              letterSpacing: 2, textTransform: "uppercase",
              padding: spacious ? "7px 14px" : "5px 11px",
              borderRadius: 3, textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 5,
              border: `1px solid ${isActive(href) ? color : color + "44"}`,
              background: isActive(href) ? `${color}10` : blink ? "rgba(255,51,51,0.04)" : "transparent",
              color: isActive(href) ? color : blink ? "#ff6666" : color,
              opacity: isActive(href) ? 1 : 0.9,
              animation: blink && !isActive(href) ? "outbreakBlink 2s ease-in-out infinite" : undefined,
              transition: "all 0.15s",
            }}>
            {blink && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff3333", display: "inline-block", animation: "obDot 1s ease-in-out infinite" }} />}
            {label}
          </Link>
        ))}
        <div style={{ width: 1, height: 18, background: "#1a3320", flexShrink: 0 }} />
        {user ? (
          <>
            <Link href="/account" style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "5px 11px", borderRadius: 3, textDecoration: "none", border: "1px solid #1a3320", color: "#00bb66" }}>ACCOUNT</Link>
            <button type="button" onClick={() => void signOut().then(afterSignOut)}
              style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "5px 11px", borderRadius: 3, border: "1px solid #1a3320", color: MUTED_UI, background: "transparent", cursor: "pointer" }}>
              SIGN OUT
            </button>
          </>
        ) : (
          <button type="button" onClick={onSignIn}
            style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "5px 11px", borderRadius: 3, border: "1px solid #1a3320", color: MUTED_UI, background: "transparent", cursor: "pointer" }}>
            SIGN IN
          </button>
        )}
        {(isBillingEnabled() && (userPlan ?? "").toLowerCase() !== "pro") && (
          onUpgrade ? (
            <button
              type="button"
              onClick={onUpgrade}
              style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "5px 11px", borderRadius: 3, border: "1px solid #00bb66", color: "#00ff88", background: "rgba(0,255,136,0.06)", cursor: "pointer" }}
            >
              PRO ▶
            </button>
          ) : (
            <Link
              href="/account"
              style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "5px 11px", borderRadius: 3, textDecoration: "none", border: "1px solid #00bb66", color: "#00ff88", background: "rgba(0,255,136,0.06)" }}
            >
              PRO ▶
            </Link>
          )
        )}
      </nav>

      {/* Mobile hamburger button */}
      <button
        ref={menuBtnRef}
        type="button"
        onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="site-mobile-menu"
        className="mobile-only"
        style={{
          display: "none", // shown via CSS mobile-only class
          alignItems: "center", justifyContent: "center",
          width: 40, height: 40,
          background: "transparent", border: "1px solid #1a3320",
          borderRadius: 3, cursor: "pointer", flexShrink: 0,
          flexDirection: "column", gap: 5,
        }}>
        <span style={{ display: "block", width: 18, height: 1.5, background: menuOpen ? "#00ff88" : "#7aaa8a", transition: "transform 0.2s, opacity 0.2s", transform: menuOpen ? "rotate(45deg) translate(0, 5px)" : "none" }} />
        <span style={{ display: "block", width: 18, height: 1.5, background: menuOpen ? "#00ff88" : "#7aaa8a", opacity: menuOpen ? 0 : 1, transition: "opacity 0.2s" }} />
        <span style={{ display: "block", width: 18, height: 1.5, background: menuOpen ? "#00ff88" : "#7aaa8a", transition: "transform 0.2s", transform: menuOpen ? "rotate(-45deg) translate(0, -5px)" : "none" }} />
      </button>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <>
          {/* Backdrop — tap outside to close */}
          <div
            aria-hidden
            onClick={() => setMenuOpen(false)}
            style={{ position: "fixed", inset: 0, top: menuTop, zIndex: 199, background: "rgba(0,0,0,0.5)" }}
          />
          <div
            ref={menuRef}
            id="site-mobile-menu"
            role="navigation"
            aria-label="Site"
            className="site-mobile-menu"
            style={{
              position: "fixed", top: menuTop, left: 0, right: 0, zIndex: 200,
              maxHeight: `calc(100dvh - ${menuTop}px)`, overflowY: "auto",
              background: "#050c07", borderBottom: "1px solid #1a3320",
              boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
              animation: "menuSlide 0.2s ease",
              display: "flex", flexDirection: "column",
            }}>
          {NAV_LINKS.map(({ href, label, color, blink }) => (
            <Link key={href} href={href}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "16px 20px",
                borderBottom: "1px solid #0d1a10",
                fontFamily: RAJ, fontSize: 16, fontWeight: 700,
                letterSpacing: 2, textTransform: "uppercase",
                textDecoration: "none",
                color: isActive(href) ? color : blink ? "#ff6666" : color,
                opacity: isActive(href) ? 1 : 0.92,
                background: isActive(href) ? `${color}08` : "transparent",
              }}>
              {blink && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff3333", display: "inline-block", animation: "obDot 1s infinite", flexShrink: 0 }} />}
              {label}
              {isActive(href) && <span style={{ marginLeft: "auto", color, fontSize: 10 }}>●</span>}
            </Link>
          ))}
          <div style={{ padding: "12px 20px", borderTop: "1px solid #1a3320", display: "flex", gap: 10 }}>
            {user ? (
              <>
                <Link href="/account" style={{ flex: 1, textAlign: "center", padding: "10px", border: "1px solid #1a3320", borderRadius: 3, color: "#00bb66", fontFamily: RAJ, fontSize: 13, fontWeight: 700, letterSpacing: 2, textDecoration: "none" }}>ACCOUNT</Link>
                <button type="button" onClick={() => void signOut().then(afterSignOut)}
                  style={{ flex: 1, padding: "10px", border: "1px solid #1a3320", borderRadius: 3, color: MUTED_UI, fontFamily: RAJ, fontSize: 13, fontWeight: 700, letterSpacing: 2, background: "transparent", cursor: "pointer" }}>SIGN OUT</button>
              </>
            ) : (
              <button type="button" onClick={() => { setMenuOpen(false); onSignIn?.(); }}
                style={{ flex: 1, padding: "10px", border: "1px solid #1a3320", borderRadius: 3, color: MUTED_UI, fontFamily: RAJ, fontSize: 13, fontWeight: 700, letterSpacing: 2, background: "transparent", cursor: "pointer" }}>SIGN IN</button>
            )}
            {(isBillingEnabled() && (userPlan ?? "").toLowerCase() !== "pro") && (
              onUpgrade ? (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onUpgrade(); }}
                  style={{ flex: 1, textAlign: "center", padding: "10px", border: "1px solid #00bb66", borderRadius: 3, color: "#00ff88", fontFamily: RAJ, fontSize: 13, fontWeight: 700, letterSpacing: 2, background: "rgba(0,255,136,0.06)", cursor: "pointer" }}
                >
                  PRO ▶
                </button>
              ) : (
                <Link href="/account"
                  style={{ flex: 1, textAlign: "center", padding: "10px", border: "1px solid #00bb66", borderRadius: 3, color: "#00ff88", fontFamily: RAJ, fontSize: 13, fontWeight: 700, letterSpacing: 2, textDecoration: "none", background: "rgba(0,255,136,0.06)" }}>PRO ▶</Link>
              )
            )}
          </div>
          </div>
        </>
      )}
    </>
  );
}
