"use client";

import Image from "next/image";
import type { NewsItem } from "@/types";

function scoreColor(s: number) {
  if (s >= 70) return "#ff3333";
  if (s >= 50) return "#ffaa00";
  return "#00bb66";
}

export default function NewsCard({
  item,
  onAnalyze,
}: {
  item: NewsItem;
  onAnalyze: (item: NewsItem) => void;
}) {
  const color = scoreColor(item.score);
  return (
    <div className="border border-[#1a3320] rounded bg-[#090f0b] overflow-hidden flex flex-col">
      {item.image ? (
        <div className="relative h-36 w-full">
          <Image src={item.image} alt="" fill unoptimized className="object-cover saturate-50 brightness-75" />
        </div>
      ) : null}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="flex justify-between items-center text-[10px] text-[#5a8068] uppercase tracking-[1.5px]">
          <span>{item.section}</span>
          <span className="px-2 py-0.5 rounded border" style={{ borderColor: color, color }}>
            {item.score}%
          </span>
        </div>
        <h3 className="font-bold text-[#e8ffe8] text-[16px] leading-snug">{item.title}</h3>
        <p className="text-[11px] text-[#7a9c86]">{item.angle}</p>
        <button
          onClick={() => onAnalyze(item)}
          className="mt-auto border rounded px-3 py-2 text-xs tracking-[2px] uppercase font-bold"
          style={{ borderColor: color, color }}
        >
          ◈ ORACLE ANALYSIS ▶
        </button>
      </div>
    </div>
  );
}
