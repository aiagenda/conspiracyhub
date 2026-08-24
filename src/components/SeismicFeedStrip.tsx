"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isM5PlusLast24h, magColor, seismicTimeAgo, type SeismicPayload } from "@/lib/seismic";

const RAJ = "var(--font-raj), sans-serif";

/** Compact M5+ last-24h strip on feed page 1. Hidden when the catalog is quiet. */
export default function SeismicFeedStrip() {
  const [payload, setPayload] = useState<SeismicPayload | null>(null);

  useEffect(() => {
    fetch("/api/seismic")
      .then((r) => r.json())
      .then((d: SeismicPayload) => {
        if (Array.isArray(d.events)) setPayload(d);
      })
      .catch(() => {});
  }, []);

  const hits = (payload?.events ?? []).filter(isM5PlusLast24h).slice(0, 3);
  if (!hits.length) return null;

  return (
    <div
      style={{
        marginBottom: "1.25rem",
        border: "1px solid rgba(255,136,68,0.45)",
        borderRadius: 4,
        background: "rgba(255,136,68,0.05)",
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#ff8844" }}>
          ◈ SEISMIC — M5+ LAST 24H
        </span>
        <Link href="/seismic" style={{ fontSize: 10, color: "#7aaa8a", letterSpacing: 1, textDecoration: "none", marginLeft: "auto" }}>
          OPEN MONITOR →
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {hits.map((e) => (
          <Link
            key={e.id}
            href="/seismic"
            style={{ fontSize: 12, color: "#c8e8d0", textDecoration: "none", lineHeight: 1.45 }}
          >
            <span style={{ fontFamily: RAJ, fontWeight: 700, color: magColor(e.mag), marginRight: 8 }}>
              M{e.mag.toFixed(1)}
            </span>
            {e.place}
            <span style={{ color: "#5a8068", marginLeft: 8 }}>{seismicTimeAgo(e.time)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
