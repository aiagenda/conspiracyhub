"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthModal from "@/components/AuthModal";
import { fetchWithSupabaseAuth } from "@/lib/authFetch";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase";

/** UX gate only; every API verifies the JWT and administrator role independently. */
export function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "allowed" | "signin" | "denied" | "error">("loading");
  const [showAuth, setShowAuth] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) { queueMicrotask(() => setState("error")); return; }
    let active = true;
    async function check() {
      try {
        if (active) setState((s) => (s === "allowed" ? s : "loading"));
        const {
          data: { session },
        } = await getSupabaseBrowserClient().auth.getSession();
        const res = await fetchWithSupabaseAuth("/api/admin/session", { cache: "no-store" });
        if (!active) return;
        if (res.ok) {
          setSignedInEmail(null);
          setState("allowed");
          return;
        }
        if (res.status === 401) {
          setSignedInEmail(null);
          setState("signin");
          return;
        }
        if (res.status === 403) {
          setSignedInEmail(session?.user?.email ?? null);
          setState("denied");
          return;
        }
        setState("error");
      } catch { if (active) setState("error"); }
    }
    void check();
    const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange(() => {
      // Avoid awaiting Supabase methods inside its synchronous auth-state callback.
      queueMicrotask(() => { if (active) void check(); });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [attempt]);
  if (state === "allowed") return children;
  return (
    <section className="mx-auto my-20 w-full max-w-xl rounded-2xl border border-white/15 bg-white/5 p-8 text-[var(--foreground)]">
      <p className="text-xs uppercase tracking-widest text-[var(--green)]">The Theorist · Editorial desk</p>
      <h1 className="mt-3 text-2xl font-semibold">{state === "loading" ? "Checking access…" : "Administrator access"}</h1>
      <p className="mt-4 leading-relaxed text-[var(--muted)]">
        {state === "signin"
          ? "Sign in with your administrator account to manage articles and sources. After clicking Sign in, wait for AUTHENTICATING… to finish — a red [ERROR] line appears if credentials fail."
          : state === "denied"
            ? signedInEmail
              ? `Signed in as ${signedInEmail}, but this account is not an administrator. In Supabase → user_profiles, set is_admin = true for this email (or use the account that registered first on the project).`
              : "Your account does not have administrator access."
          : state === "error" ? "The editorial desk is unavailable. Check the Supabase configuration or try again."
          : "Verifying your account and permissions."}
      </p>
      <div className="mt-6 flex gap-4">
        {state === "signin" && (
          <button className="rounded bg-[var(--green)] px-4 py-2 text-black" onClick={() => setShowAuth(true)}>
            Sign in
          </button>
        )}
        {state === "denied" && (
          <>
            <Link className="rounded bg-[var(--green)] px-4 py-2 text-black no-underline" href="/account">
              Account
            </Link>
            <button type="button" className="rounded border px-4 py-2" onClick={() => void getSupabaseBrowserClient().auth.signOut().then(() => setAttempt((n) => n + 1))}>
              Sign out
            </button>
          </>
        )}
        {state === "error" && <button className="rounded border px-4 py-2" onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
        <Link className="px-4 py-2 underline" href="/">Back to the site</Link>
      </div>
      {showAuth && (
        <AuthModal
          onClose={() => {
            setShowAuth(false);
            setState("loading");
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}
