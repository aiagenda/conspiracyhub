"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, signOut } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

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
  { href: "/community", label: "COMMUNITY", color: "#00bb66" },
  { href: "/blog", label: "ANALYSIS", color: "#c94dff" },
  { href: "/search", label: "SEARCH", color: "#5a8068" },
  { href: "/guide", label: "GUIDE", color: "#5a8068" },
];

export default function SiteNav({ spacious, user: userProp, userPlan, onSignIn, onUpgrade, onSignedOut }: Props) {
  const pathname = usePathname() ?? "";
  const controlled = userProp !== undefined;
  const [uncontrolledUser, setUncontrolledUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const user = controlled ? (userProp ?? null) : uncontrolledUser;

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
      <style>{`
        @keyframes outbreakBlink{0%,100%{border-color:#ff3333;box-shadow:0 0 5px rgba(255,51,51,0.3)}50%{border-color:rgba(255,51,51,0.3);box-shadow:none}}
        @keyframes obDot{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes menuSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

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
              color: isActive(href) ? color : blink ? "#ff3333" : "#5a8068",
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
              style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "5px 11px", borderRadius: 3, border: "1px solid #1a3320", color: "#5a8068", background: "transparent", cursor: "pointer" }}>
              SIGN OUT
            </button>
          </>
        ) : (
          <button type="button" onClick={onSignIn}
            style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "5px 11px", borderRadius: 3, border: "1px solid #1a3320", color: "#5a8068", background: "transparent", cursor: "pointer" }}>
            SIGN IN
          </button>
        )}
        {(userPlan ?? "").toLowerCase() !== "pro" && (
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
        type="button"
        onClick={() => setMenuOpen(o => !o)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        className="mobile-only"
        style={{
          display: "none", // shown via CSS mobile-only class
          alignItems: "center", justifyContent: "center",
          width: 40, height: 40,
          background: "transparent", border: "1px solid #1a3320",
          borderRadius: 3, cursor: "pointer", flexShrink: 0,
          flexDirection: "column", gap: 5,
        }}>
        <span style={{ display: "block", width: 18, height: 1.5, background: menuOpen ? "#00ff88" : "#5a8068", transition: "transform 0.2s, opacity 0.2s", transform: menuOpen ? "rotate(45deg) translate(0, 5px)" : "none" }} />
        <span style={{ display: "block", width: 18, height: 1.5, background: menuOpen ? "#00ff88" : "#5a8068", opacity: menuOpen ? 0 : 1, transition: "opacity 0.2s" }} />
        <span style={{ display: "block", width: 18, height: 1.5, background: menuOpen ? "#00ff88" : "#5a8068", transition: "transform 0.2s", transform: menuOpen ? "rotate(-45deg) translate(0, -5px)" : "none" }} />
      </button>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div style={{
          position: "fixed", top: 52, left: 0, right: 0, zIndex: 200,
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
                color: isActive(href) ? color : blink ? "#ff3333" : "#7aaa8a",
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
                  style={{ flex: 1, padding: "10px", border: "1px solid #1a3320", borderRadius: 3, color: "#5a8068", fontFamily: RAJ, fontSize: 13, fontWeight: 700, letterSpacing: 2, background: "transparent", cursor: "pointer" }}>SIGN OUT</button>
              </>
            ) : (
              <button type="button" onClick={() => { setMenuOpen(false); onSignIn?.(); }}
                style={{ flex: 1, padding: "10px", border: "1px solid #1a3320", borderRadius: 3, color: "#5a8068", fontFamily: RAJ, fontSize: 13, fontWeight: 700, letterSpacing: 2, background: "transparent", cursor: "pointer" }}>SIGN IN</button>
            )}
            {(userPlan ?? "").toLowerCase() !== "pro" && (
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
      )}
    </>
  );
}
