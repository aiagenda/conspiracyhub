"use client";

import { useEffect, useState } from "react";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth";
import { parseNicknameInput } from "@/lib/nickname";
import { isSupabaseBrowserConfigured } from "@/lib/supabase";

const RAJ = "var(--font-raj), sans-serif";
const MONO = "var(--font-share-tech-mono), monospace";

type SignupSuccessMode = "confirm_email" | "signed_in";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState<{ mode: SignupSuccessMode; email: string } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function switchTab(t: "signin" | "signup") {
    setTab(t);
    setError("");
    setSignupSuccess(null);
    if (t === "signin") setNickname("");
  }

  async function submit() {
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
        onClose();
        return;
      }

      const nickCheck = parseNicknameInput(nickname);
      if (!nickCheck.ok || !nickCheck.value) {
        const msg = !nickCheck.ok
          ? nickCheck.error === "nickname_too_short"
            ? "Display name must be at least 2 characters."
            : nickCheck.error === "nickname_too_long"
              ? "Display name is too long (max 40 characters)."
              : "Display name: use letters, numbers, spaces, _ - . only."
          : "Display name is required.";
        setError(msg);
        return;
      }

      const { data, error: authError } = await signUpWithEmail(email, password, {
        nickname: nickCheck.value,
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      const hasSession = Boolean(data?.session);
      setSignupSuccess({
        mode: hasSession ? "signed_in" : "confirm_email",
        email: email.trim(),
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

  const isSuccess = signupSuccess !== null;

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
              ? signupSuccess.mode === "confirm_email"
                ? "◈ VERIFY TRANSMISSION"
                : "◈ ACCESS GRANTED"
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
                ) : (
                  <>
                    Your account is live — no email step required on this server. You can close this panel and keep
                    investigating.
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
          </div>
        ) : (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* TABS */}
            <div style={{ display: "flex", gap: 6 }}>
              {(["signin", "signup"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTab(t)}
                  style={{
                    flex: 1,
                    padding: "7px",
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
                  }}
                >
                  {t === "signin" ? "SIGN IN" : "SIGN UP"}
                </button>
              ))}
            </div>

            {/* INPUTS */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tab === "signup" && (
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
                    DISPLAY NAME
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. DeepStateDave"
                    autoComplete="nickname"
                    maxLength={48}
                    style={inp}
                    onFocus={(e) => {
                      (e.target as HTMLInputElement).style.borderColor = "#00bb66";
                    }}
                    onBlur={(e) => {
                      (e.target as HTMLInputElement).style.borderColor = "#1a3320";
                    }}
                  />
                  <div style={{ fontSize: 8, color: "#3a5040", marginTop: 4, letterSpacing: 0.3 }}>
                    2–40 characters · letters, numbers, spaces, _ - .
                  </div>
                </div>
              )}
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
          </div>
        )}
      </div>
    </div>
  );
}
