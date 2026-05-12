"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, signOut } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

type Props = {
  spacious?: boolean;
  /** If parent already has user state, pass it to avoid double-fetch */
  user?: User | null;
  onSignIn?: () => void;
};

export default function SiteNav({ spacious, user: userProp, onSignIn }: Props) {
  const pathname = usePathname() ?? "";
  const [user, setUser] = useState<User | null>(userProp ?? null);

  // Only self-fetch if parent didn't provide user
  useEffect(() => {
    if (userProp !== undefined) return;
    void getCurrentUser().then(setUser);
  }, [userProp]);

  const pad = spacious ? "8px 18px" : "6px 14px";
  const fontSize = spacious ? 13 : 11;

  function base(active: boolean, activeColor = "#00bb66", activeBg = "rgba(0,255,136,0.08)") {
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
      border: `1px solid ${active ? activeColor : "#1a3320"}`,
      background: active ? activeBg : "transparent",
      color: active ? activeColor : "#5a8068",
      transition: "all 0.15s",
    };
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav aria-label="Main" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <Link href="/" style={base(isActive("/") && pathname === "/")} aria-current={pathname === "/" ? "page" : undefined}>
        FEED
      </Link>

      <Link href="/search" style={base(isActive("/search"))} aria-current={isActive("/search") ? "page" : undefined}>
        SEARCH
      </Link>

      <Link
        href="/uap"
        style={base(isActive("/uap"), "#8aa6ff", "rgba(145,170,255,0.12)")}
        aria-current={isActive("/uap") ? "page" : undefined}
      >
        UAP
      </Link>

      <Link
        href="/outbreaks"
        style={{
          ...base(isActive("/outbreaks"), "#ff5555", "rgba(255,51,51,0.12)"),
          color: isActive("/outbreaks") ? "#ffaaaa" : "#ff3333",
          boxShadow: isActive("/outbreaks") ? "0 0 8px rgba(255,51,51,0.25)" : undefined,
        }}
        aria-current={isActive("/outbreaks") ? "page" : undefined}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff3333", display: "inline-block" }} aria-hidden />
        OUTBREAKS
      </Link>

      <Link href="/community" style={base(isActive("/community"))} aria-current={isActive("/community") ? "page" : undefined}>
        ◈ COMMUNITY
      </Link>

      <Link href="/guide" style={base(isActive("/guide"))} aria-current={isActive("/guide") ? "page" : undefined}>
        GUIDE
      </Link>

      {user ? (
        <>
          <Link href="/account" style={base(isActive("/account"))} aria-current={isActive("/account") ? "page" : undefined}>
            ACCOUNT
          </Link>
          <button
            type="button"
            onClick={() => void signOut().then(() => setUser(null))}
            style={{ ...base(false), cursor: "pointer", background: "transparent" }}
            aria-label="Sign out"
          >
            SIGN OUT
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onSignIn}
          style={{ ...base(false), cursor: "pointer", background: "transparent" }}
          aria-label="Sign in"
        >
          SIGN IN
        </button>
      )}
    </nav>
  );
}
