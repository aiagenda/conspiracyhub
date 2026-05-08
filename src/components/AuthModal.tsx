"use client";

import { useState } from "react";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const action = tab === "signin" ? signInWithEmail : signUpWithEmail;
    const { error: authError } = await action(email, password);
    if (authError) {
      setError(authError.message);
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#090f0b] border border-[#1a3320] rounded p-4 text-[#c8e8d0]">
        <div className="flex justify-between items-center mb-4">
          <div className="text-[#00ff88] tracking-[3px] text-xs">AUTH</div>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="flex gap-2 mb-3">
          <button className={`px-2 py-1 border ${tab === "signin" ? "border-[#00bb66]" : "border-[#1a3320]"}`} onClick={() => setTab("signin")}>
            Sign in
          </button>
          <button className={`px-2 py-1 border ${tab === "signup" ? "border-[#00bb66]" : "border-[#1a3320]"}`} onClick={() => setTab("signup")}>
            Sign up
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="bg-[#050c07] border border-[#1a3320] px-3 py-2" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="bg-[#050c07] border border-[#1a3320] px-3 py-2" />
          <button onClick={submit} className="border border-[#00bb66] text-[#00ff88] py-2">
            {tab === "signin" ? "SIGN IN" : "SIGN UP"}
          </button>
          {error ? <div className="text-[#ff3333] text-xs">[ERROR] {error}</div> : null}
        </div>
      </div>
    </div>
  );
}
