"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";
import NewsCard from "@/components/NewsCard";
import UpgradeModal from "@/components/UpgradeModal";
import type { NewsItem } from "@/types";

export default function FeedScreen({ initialItems }: { initialItems: NewsItem[] }) {
  const [filter, setFilter] = useState("all");
  const [showAuth, setShowAuth] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const router = useRouter();

  const sections = useMemo(() => ["all", ...new Set(initialItems.map((i) => i.section))], [initialItems]);
  const visible = filter === "all" ? initialItems : initialItems.filter((i) => i.section === filter);

  async function startCheckout() {
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  function analyze(item: NewsItem) {
    router.push(`/board/${item.id}`);
  }

  return (
    <div className="min-h-screen bg-[#050c07] text-[#c8e8d0] px-4 pb-8">
      <div className="max-w-6xl mx-auto">
        <header className="h-12 border-b border-[#1a3320] flex items-center justify-between">
          <div className="text-[#00ff88] tracking-[3px] font-bold">THE THEORIST</div>
          <div className="flex gap-2">
            <button onClick={() => setShowAuth(true)} className="border border-[#1a3320] px-3 text-xs text-[#5a8068]">
              Sign in
            </button>
            <button onClick={() => setShowUpgrade(true)} className="border border-[#00bb66] px-3 text-xs text-[#00ff88]">
              Pro subscription
            </button>
          </div>
        </header>

        <div className="h-8 border-b border-[#1a3320] overflow-hidden flex items-center text-[#3a6040] text-xs whitespace-nowrap">
          <div className="animate-pulse px-3">▸ LIVE conspiracy feed</div>
        </div>

        <div className="py-4 flex gap-2 flex-wrap">
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`border px-3 py-1 uppercase text-xs tracking-[1px] ${filter === s ? "border-[#00bb66] text-[#00ff88]" : "border-[#1a3320] text-[#5a8068]"}`}
            >
              {s}
            </button>
          ))}
        </div>

        {visible.length === 0 ? <div className="text-[#5a8068]">Not enough high-conspiracy-potential news in this category.</div> : null}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((item) => (
            <NewsCard key={item.id} item={item} onAnalyze={analyze} />
          ))}
        </div>
      </div>

      {showAuth ? <AuthModal onClose={() => setShowAuth(false)} /> : null}
      {showUpgrade ? <UpgradeModal onClose={() => setShowUpgrade(false)} onUpgrade={startCheckout} /> : null}
    </div>
  );
}
