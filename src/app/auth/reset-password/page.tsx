"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { updatePassword } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase";
import { pageContentShellStyle } from "@/lib/pageShell";

const RAJ = "var(--font-raj), sans-serif";
const MONO = "var(--font-share-tech-mono), monospace";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) {
      setError("Supabase is not configured on this host.");
      setReady(true);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const checkRecovery = async () => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const isRecoveryHash = hash.includes("type=recovery") || hash.includes("access_token=");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session || isRecoveryHash) {
        setRecovery(true);
      }
      setReady(true);
    };

    void checkRecovery();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setRecovery(true);
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function submit() {
    if (!password || !confirm) {
      setError("Enter and confirm your new password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await updatePassword(password);
      if (authError) {
        setError(authError.message);
        return;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    background: "#050c07",
    border: "1px solid #1a3320",
    borderRadius: 3,
    padding: "9px 12px",
    color: "#00ff88",
    fontFamily: MONO,
    fontSize: 12,
    outline: "none",
    width: "100%",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#040b06", display: "flex", flexDirection: "column" }}>
      <div style={pageContentShellStyle({ maxWidth: 440, paddingTop: "max(2rem, 8vh)" })}>
        <div
          style={{
            background: "#090f0b",
            border: "1px solid #1a3320",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid #1a3320",
              background: "linear-gradient(180deg, #061208 0%, #050c07 100%)",
            }}
          >
            <div
              style={{
                fontFamily: RAJ,
                fontSize: 11,
                fontWeight: 700,
                color: "#00bb66",
                letterSpacing: 4,
                textTransform: "uppercase",
              }}
            >
              {done ? "◈ CREDENTIALS UPDATED" : "◈ RESET PASSWORD"}
            </div>
          </div>

          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            {!ready ? (
              <p style={{ fontFamily: MONO, fontSize: 11, color: "#5a8068", margin: 0 }}>Verifying reset link…</p>
            ) : done ? (
              <>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                  <p style={{ fontFamily: MONO, fontSize: 11, color: "#7aaa8a", lineHeight: 1.75, margin: 0 }}>
                    Your new password is active. You can sign in with it now.
                  </p>
                </div>
                <Link
                  href="/"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "12px 16px",
                    background: "linear-gradient(180deg, rgba(0,255,136,0.12) 0%, rgba(0,187,102,0.06) 100%)",
                    border: "1px solid #00bb66",
                    color: "#00ff88",
                    fontFamily: RAJ,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    borderRadius: 4,
                    textDecoration: "none",
                  }}
                >
                  Continue to site ▶
                </Link>
              </>
            ) : !recovery ? (
              <>
                <p style={{ fontFamily: MONO, fontSize: 11, color: "#7aaa8a", lineHeight: 1.75, margin: 0 }}>
                  This reset link is invalid or has expired. Request a new one from the sign-in screen.
                </p>
                {error ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#ff3333",
                      padding: "8px 10px",
                      border: "1px solid rgba(255,51,51,0.3)",
                      borderRadius: 3,
                      background: "rgba(255,51,51,0.05)",
                    }}
                  >
                    [ERROR] {error}
                  </div>
                ) : null}
                <Link
                  href="/"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "12px 16px",
                    border: "1px solid #1a3320",
                    color: "#5a8068",
                    fontFamily: RAJ,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    borderRadius: 4,
                    textDecoration: "none",
                  }}
                >
                  ← Back home
                </Link>
              </>
            ) : (
              <>
                <p style={{ fontFamily: MONO, fontSize: 11, color: "#5a8068", lineHeight: 1.75, margin: 0 }}>
                  Choose a new password for your operative profile.
                </p>
                <div>
                  <label
                    style={{
                      fontSize: 9,
                      color: "#5a8068",
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: 5,
                    }}
                  >
                    NEW PASSWORD
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    style={inp}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 9,
                      color: "#5a8068",
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: 5,
                    }}
                  >
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void submit()}
                    placeholder="Repeat password"
                    style={inp}
                    autoComplete="new-password"
                  />
                </div>
                {error ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#ff3333",
                      padding: "8px 10px",
                      border: "1px solid rgba(255,51,51,0.3)",
                      borderRadius: 3,
                      background: "rgba(255,51,51,0.05)",
                    }}
                  >
                    [ERROR] {error}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={loading}
                  style={{
                    padding: "12px 16px",
                    background: "transparent",
                    border: "1px solid #00bb66",
                    color: "#00ff88",
                    fontFamily: RAJ,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    borderRadius: 3,
                    cursor: "pointer",
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {loading ? "UPDATING..." : "SET NEW PASSWORD ▶"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
