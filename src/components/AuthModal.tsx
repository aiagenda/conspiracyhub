"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { resetPasswordForEmail, signInWithEmail, signUpWithEmail } from "@/lib/auth";
import { isSupabaseBrowserConfigured } from "@/lib/supabase";
import { isBillingEnabled } from "@/lib/featureFlags";

const RAJ = "var(--font-raj), sans-serif";
const MONO = "var(--font-share-tech-mono), monospace";

type SignupSuccessMode = "confirm_email" | "signed_in";

type SignupSuccess = {
  mode: SignupSuccessMode;
  email: string;
  foundingMember?: boolean;
  trialDays?: number;
};

export default function AuthModal({
  onClose,
  initialTab = "signin",
}: {
  onClose: () => void;
  initialTab?: "signin" | "signup";
}) {
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">(initialTab === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState<SignupSuccess | null>(null);
  const [forgotSuccessEmail, setForgotSuccessEmail] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab === "signup" ? "signup" : "signin");
  }, [initialTab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function switchTab(t: "signin" | "signup" | "forgot") {
    setTab(t);
    setError("");
    setSignupSuccess(null);
    setForgotSuccessEmail(null);
  }

  async function submit() {
    if (tab === "forgot") {
      if (!email.trim()) {
        setError("Email required.");
        return;
      }
      if (!isSupabaseBrowserConfigured()) {
        setError(
          "Server misconfiguration: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set on the host (e.g. Vercel env), then redeploy."
        );
        return;
      }
      setError("");
      setLoading(true);
      try {
        const { error: authError } = await resetPasswordForEmail(email);
        if (authError) {
          setError(authError.message);
          return;
        }
        setForgotSuccessEmail(email.trim());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send reset email.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) {
      setError("Email and password required.");
      return;
    }
    if (!isSupabaseBrowserConfigured()) {
      setError(
        "Server misconfiguration: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set on the host (e.g. Vercel env), then redeploy."
      );
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (tab === "signin") {
        const { error: authError } = await signInWithEmail(email, password);
        if (authError) {
          setError(authError.message);
          return;
        }
        posthog.identify(email.trim(), { email: email.trim() });
        posthog.capture("user_signed_in", { email: email.trim() });
        onClose();
        return;
      }

      const { data, error: authError } = await signUpWithEmail(email, password);
      if (authError) {
        setError(authError.message);
        return;
      }
      const hasSession = Boolean(data?.session);
      const userId = data?.user?.id;
      posthog.identify(userId ?? email.trim(), { email: email.trim() });
      posthog.capture("user_signed_up", {
        email: email.trim(),
        signup_mode: hasSession ? "signed_in" : "confirm_email",
      });

      let foundingMember = false;
      let trialDays = 30;
      if (hasSession && data?.session?.access_token) {
        try {
          const accRes = await fetch("/api/account", {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          if (accRes.ok) {
            const acc = (await accRes.json()) as {
              founding_member?: boolean;
              analyst_pass_trial_days?: number | null;
            };
            foundingMember = Boolean(acc.founding_member);
            trialDays = acc.analyst_pass_trial_days ?? (foundingMember ? 90 : 30);
          }
        } catch {
          /* profile may load on next visit */
        }
      }

      setSignupSuccess({
        mode: hasSession ? "signed_in" : "confirm_email",
        email: email.trim(),
        foundingMember,
        trialDays,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
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

  const isSuccess = signupSuccess !== null || forgotSuccessEmail !== null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(4,11,6,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <style>{`
        @keyframes authModalGlow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(0,187,102,0.25), 0 0 24px rgba(0,255,136,0.08); }
          50% { box-shadow: 0 0 0 1px rgba(0,255,136,0.35), 0 0 32px rgba(0,255,136,0.14); }
        }
        @keyframes authPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.92); }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-slide-in"
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#090f0b",
          border: "1px solid #1a3320",
          borderRadius: 6,
          overflow: "hidden",
          animation: isSuccess ? "authModalGlow 3s ease-in-out infinite" : undefined,
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #1a3320",
            background: "linear-gradient(180deg, #061208 0%, #050c07 100%)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
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
            {isSuccess
              ? forgotSuccessEmail
                ? "◈ RESET TRANSMITTED"
                : signupSuccess!.mode === "confirm_email"
                  ? "◈ VERIFY TRANSMISSION"
                  : "◈ ACCESS GRANTED"
              : tab === "forgot"
                ? "◈ RECOVER ACCESS"
                : "◈ SECURE ACCESS"}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #1a3320",
              color: "#5a8068",
              fontFamily: "inherit",
              fontSize: 10,
              padding: "4px 9px",
              borderRadius: 2,
              cursor: "pointer",
              letterSpacing: 1,
            }}
          >
            ✕
          </button>
        </div>

        {isSuccess ? (
          <div style={{ padding: "28px 24px 26px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            {forgotSuccessEmail ? (
              <>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    border: "1px solid rgba(0,255,136,0.35)",
                    background: "radial-gradient(circle at 30% 30%, rgba(0,255,136,0.12), transparent 55%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    lineHeight: 1,
                  }}
                >
                  <span style={{ animation: "authPulseDot 2s ease-in-out infinite" }}>✉</span>
                </div>
                <div style={{ textAlign: "center", maxWidth: 360 }}>
                  <div
                    style={{
                      fontFamily: RAJ,
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#e8ffe8",
                      letterSpacing: 1.5,
                      marginBottom: 10,
                      lineHeight: 1.25,
                    }}
                  >
                    Reset link sent
                  </div>
                  <p
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      color: "#5a8068",
                      lineHeight: 1.75,
                      margin: 0,
                      letterSpacing: 0.3,
                    }}
                  >
                    We sent a <strong style={{ color: "#00bb66" }}>password reset link</strong> to your inbox. Open it to
                    set a new password.
                  </p>
                </div>
                <div
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 4,
                    border: "1px solid #1a3320",
                    background: "rgba(0,20,10,0.45)",
                  }}
                >
                  <div style={{ fontSize: 8, color: "#3a5040", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
                    Target address
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 12,
                      color: "#00ff88",
                      wordBreak: "break-all",
                      lineHeight: 1.5,
                    }}
                  >
                    {forgotSuccessEmail}
                  </div>
                </div>
                <ul
                  style={{
                    margin: 0,
                    padding: "0 0 0 18px",
                    width: "100%",
                    fontFamily: MONO,
                    fontSize: 10,
                    color: "#4a7058",
                    lineHeight: 1.85,
                    letterSpacing: 0.2,
                  }}
                >
                  <li>Check <strong style={{ color: "#6a9080" }}>Inbox</strong> and wait a minute for delivery.</li>
                  <li>
                    If nothing appears, open <strong style={{ color: "#6a9080" }}>Spam / Junk</strong> or{" "}
                    <strong style={{ color: "#6a9080" }}>Promotions</strong>.
                  </li>
                  <li>The link opens a page where you choose a new password.</li>
                </ul>
                <button
                  type="button"
                  onClick={() => switchTab("signin")}
                  style={{
                    marginTop: 4,
                    width: "100%",
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
                    cursor: "pointer",
                  }}
                >
                  Back to sign in
                </button>
              </>
            ) : signupSuccess ? (
              <>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: "1px solid rgba(0,255,136,0.35)",
                background: "radial-gradient(circle at 30% 30%, rgba(0,255,136,0.12), transparent 55%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                lineHeight: 1,
              }}
            >
              <span style={{ animation: "authPulseDot 2s ease-in-out infinite" }}>
                {signupSuccess.mode === "confirm_email" ? "✉" : "✓"}
              </span>
            </div>

            <div style={{ textAlign: "center", maxWidth: 360 }}>
              <div
                style={{
                  fontFamily: RAJ,
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#e8ffe8",
                  letterSpacing: 1.5,
                  marginBottom: 10,
                  lineHeight: 1.25,
                }}
              >
                {signupSuccess.mode === "confirm_email"
                  ? "Registration complete"
                  : "You're signed in"}
              </div>
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  color: "#5a8068",
                  lineHeight: 1.75,
                  margin: 0,
                  letterSpacing: 0.3,
                }}
              >
                {signupSuccess.mode === "confirm_email" ? (
                  <>
                    We sent a <strong style={{ color: "#00bb66" }}>confirmation link</strong> to your inbox. Open it to
                    activate your operative profile.
                  </>
                ) : isBillingEnabled() ? (
                  <>
                    Your account is live with a{" "}
                    <strong style={{ color: "#00bb66" }}>
                      {signupSuccess.trialDays ?? 30}-day Analyst Pass
                    </strong>
                    {signupSuccess.foundingMember ? " (founding operative)" : ""} — full PRO (Oracle, URL
                    analysis, highlights). Open Account anytime to see days remaining.
                  </>
                ) : (
                  <>
                    Your account is live — full access to Oracle, Investigation Boards, URL analysis, and email
                    preferences. Open <strong style={{ color: "#00bb66" }}>Account</strong> to manage notifications.
                  </>
                )}
              </p>
            </div>

            {signupSuccess.mode === "confirm_email" && (
              <>
                <div
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 4,
                    border: "1px solid #1a3320",
                    background: "rgba(0,20,10,0.45)",
                  }}
                >
                  <div style={{ fontSize: 8, color: "#3a5040", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
                    Target address
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 12,
                      color: "#00ff88",
                      wordBreak: "break-all",
                      lineHeight: 1.5,
                    }}
                  >
                    {signupSuccess.email}
                  </div>
                </div>

                <ul
                  style={{
                    margin: 0,
                    padding: "0 0 0 18px",
                    width: "100%",
                    fontFamily: MONO,
                    fontSize: 10,
                    color: "#4a7058",
                    lineHeight: 1.85,
                    letterSpacing: 0.2,
                  }}
                >
                  {isBillingEnabled() && (
                    <li>Early operatives may receive a <strong style={{ color: "#6a9080" }}>90-day Analyst Pass</strong> after confirming.</li>
                  )}
                  <li>Check <strong style={{ color: "#6a9080" }}>Inbox</strong> and wait a minute for delivery.</li>
                  <li>
                    If nothing appears, open <strong style={{ color: "#6a9080" }}>Spam / Junk</strong> or{" "}
                    <strong style={{ color: "#6a9080" }}>Promotions</strong> (Gmail).
                  </li>
                  <li>Mark the message as “Not spam” so future alerts reach you.</li>
                </ul>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: 4,
                width: "100%",
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
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {signupSuccess.mode === "confirm_email" ? "Understood — close" : "Continue ▶"}
            </button>

            <div style={{ fontSize: 8, color: "#2a4030", letterSpacing: 1.2, textAlign: "center" }}>
              LINK EXPIRES PER SUPABASE POLICY · RESEND FROM LOGIN IF NEEDED
            </div>
              </>
            ) : null}
          </div>
        ) : (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {tab === "forgot" ? (
              <>
                <p
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: "#5a8068",
                    lineHeight: 1.65,
                    margin: 0,
                    letterSpacing: 0.2,
                  }}
                >
                  Enter your account email. We&apos;ll send a secure link to set a new password.
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
                    EMAIL
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void submit()}
                    placeholder="operative@theorist.io"
                    style={inp}
                    autoFocus
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
                    padding: "10px",
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
                  {loading ? "SENDING..." : "SEND RESET LINK ▶"}
                </button>
                <button
                  type="button"
                  onClick={() => switchTab("signin")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#5a8068",
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: 1,
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  ← Back to sign in
                </button>
              </>
            ) : (
              <>
            {/* TABS */}
            <div style={{ display: "flex", gap: 6 }}>
              {(["signin", "signup"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTab(t)}
                  style={{
                    flex: 1,
                    padding: "9px 16px",
                    fontFamily: RAJ,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    border: `1px solid ${tab === t ? "#00bb66" : "#1a3320"}`,
                    background: tab === t ? "rgba(0,255,136,0.06)" : "transparent",
                    color: tab === t ? "#00ff88" : "#5a8068",
                    borderRadius: 3,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {t === "signin" ? "SIGN IN" : "SIGN UP"}
                </button>
              ))}
            </div>

            {tab === "signup" && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 4,
                  border: "1px solid rgba(0,187,102,0.4)",
                  background: "rgba(0,255,136,0.06)",
                  fontFamily: MONO,
                  fontSize: 10,
                  color: "#9ac8b0",
                  lineHeight: 1.6,
                  letterSpacing: 0.3,
                }}
              >
                {isBillingEnabled() ? (
                  <>
                    <strong style={{ color: "#00ff88" }}>90-day Analyst Pass</strong> for early operatives (then 30-day) —
                    full PRO after signup (Oracle, URL analyzer, all highlights). No credit card required for the trial.
                  </>
                ) : (
                  <>
                    Free registration — full access to Oracle, Investigation Boards, URL analysis, and optional weekly
                    intelligence briefing emails.
                  </>
                )}
              </div>
            )}

            {/* INPUTS */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                  EMAIL
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operative@theorist.io"
                  style={inp}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = "#00bb66";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = "#1a3320";
                  }}
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
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submit()}
                  placeholder="••••••••••••"
                  style={inp}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = "#00bb66";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = "#1a3320";
                  }}
                />
                {tab === "signin" ? (
                  <button
                    type="button"
                    onClick={() => switchTab("forgot")}
                    style={{
                      marginTop: 8,
                      background: "transparent",
                      border: "none",
                      color: "#5a8068",
                      fontFamily: MONO,
                      fontSize: 9,
                      letterSpacing: 1,
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                    }}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>
            </div>

            {/* ERROR */}
            {error && (
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
            )}

            {/* SUBMIT */}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={loading}
              style={{
                padding: "10px",
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
                transition: "all 0.15s",
              }}
            >
              {loading ? "AUTHENTICATING..." : tab === "signin" ? "SIGN IN ▶" : "CREATE ACCOUNT ▶"}
            </button>

            <div style={{ fontSize: 9, color: "#3a5040", lineHeight: 1.7, textAlign: "center", letterSpacing: 1 }}>
              CREDENTIALS ARE ENCRYPTED · NEVER SHARED
            </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
