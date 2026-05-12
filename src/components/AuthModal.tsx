"use client";

import { useEffect, useState } from "react";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth";
import { isSupabaseBrowserConfigured } from "@/lib/supabase";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    const action = tab === "signin" ? signInWithEmail : signUpWithEmail;
    try {
      const { error: authError } = await action(email, password);
      if (authError) {
        setError(authError.message);
        return;
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    background: "#050c07", border: "1px solid #1a3320", borderRadius: 3,
    padding: "9px 12px", color: "#00ff88", fontFamily: "var(--font-share-tech-mono), monospace",
    fontSize: 12, outline: "none", width: "100%", transition: "border-color 0.2s",
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(4,11,6,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="animate-fade-slide-in" style={{ width: "100%", maxWidth: 420, background: "#090f0b", border: "1px solid #1a3320", borderRadius: 4, overflow: "hidden" }}>

        {/* HEADER */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a3320", background: "#050c07", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, color: "#00bb66", letterSpacing: 4, textTransform: "uppercase" }}>
            ◈ SECURE ACCESS
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: "inherit", fontSize: 10, padding: "3px 8px", borderRadius: 2, cursor: "pointer", letterSpacing: 1 }}>✕</button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* TABS */}
          <div style={{ display: "flex", gap: 6 }}>
            {(["signin", "signup"] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                style={{ flex: 1, padding: "7px", fontFamily: "var(--font-raj), sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", border: `1px solid ${tab === t ? "#00bb66" : "#1a3320"}`, background: tab === t ? "rgba(0,255,136,0.06)" : "transparent", color: tab === t ? "#00ff88" : "#5a8068", borderRadius: 3, cursor: "pointer" }}
              >
                {t === "signin" ? "SIGN IN" : "SIGN UP"}
              </button>
            ))}
          </div>

          {/* INPUTS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 5 }}>EMAIL</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="operative@theorist.io" style={inp}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#00bb66"; }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "#1a3320"; }}
              />
            </div>
            <div>
              <label style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 5 }}>PASSWORD</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="••••••••••••" style={inp}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#00bb66"; }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "#1a3320"; }}
              />
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div style={{ fontSize: 11, color: "#ff3333", padding: "8px 10px", border: "1px solid rgba(255,51,51,0.3)", borderRadius: 3, background: "rgba(255,51,51,0.05)" }}>
              [ERROR] {error}
            </div>
          )}

          {/* SUBMIT */}
          <button
            onClick={submit} disabled={loading}
            style={{ padding: "10px", background: "transparent", border: "1px solid #00bb66", color: "#00ff88", fontFamily: "var(--font-raj), sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", borderRadius: 3, cursor: "pointer", opacity: loading ? 0.5 : 1, transition: "all 0.15s" }}
          >
            {loading ? "AUTHENTICATING..." : tab === "signin" ? "SIGN IN ▶" : "CREATE ACCOUNT ▶"}
          </button>

          <div style={{ fontSize: 9, color: "#3a5040", lineHeight: 1.7, textAlign: "center", letterSpacing: 1 }}>
            CREDENTIALS ARE ENCRYPTED · NEVER SHARED
          </div>
        </div>
      </div>
    </div>
  );
}
