"use client";
import Link from "next/link";
import { useState } from "react";
import type { NewsItem } from "@/types";

/** Real feed headlines supply the ticker; no invented live-system status. */
export default function HeadlineTicker({ items }: { items: NewsItem[] }) {
  const [paused, setPaused] = useState(false);
  if (!items.length) return null;
  const headlines = items.slice(0, 5);
  return <div className="desk-ticker" aria-label="Recent headlines">
    <span className="desk-ticker-label"><span aria-hidden="true">↳</span> INCOMING<button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Resume headline ticker" : "Pause headline ticker"}>{paused ? "▷" : "Ⅱ"}</button></span>
    <div className="desk-ticker-window"><div className="desk-ticker-track" style={paused ? { animationPlayState: "paused" } : undefined}>
      {[false, true].map(duplicate => <div className="desk-ticker-set" key={String(duplicate)} aria-hidden={duplicate || undefined}>{headlines.map(item => <Link key={item.id} href={`/article/${item.id}`} tabIndex={duplicate ? -1 : undefined}><span aria-hidden="true">+</span>{item.title}</Link>)}</div>)}
    </div></div>
  </div>;
}
