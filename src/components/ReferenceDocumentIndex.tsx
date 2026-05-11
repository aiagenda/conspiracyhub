"use client";

import { useCallback, useEffect, useState } from "react";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

export type ReferenceDoc = {
  id: string;
  agency: string;
  title: string;
  canonical_url: string;
  excerpt: string | null;
  year: number | null;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function ReferenceDocumentIndex() {
  const [agency, setAgency] = useState("all");
  const [letter, setLetter] = useState<string | null>(null);
  const [filterQ, setFilterQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [documents, setDocuments] = useState<ReferenceDoc[]>([]);
  const [agencies, setAgencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filterQ.trim()), 300);
    return () => clearTimeout(t);
  }, [filterQ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (agency !== "all") params.set("agency", agency);
      if (letter) params.set("letter", letter);
      if (debouncedQ) params.set("q", debouncedQ);
      const res = await fetch(`/api/reference-documents?${params}`);
      const data = (await res.json()) as { documents?: ReferenceDoc[]; agencies?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load index");
      setDocuments(data.documents ?? []);
      setAgencies(data.agencies ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [agency, letter, debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <div style={{ fontSize: 11, color: "#3a5040", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
        ◈ Official & declassified reference index
      </div>
      <p style={{ fontFamily: FONT, fontSize: 13, color: "#5a8068", lineHeight: 1.75, margin: "0 0 16px", maxWidth: "none" }}>
        Curated links to primary portals and landmark collections (CIA, FBI Vault, NARA, NSA, DOD, etc.). Opens the official site in a new tab — we do not mirror PDFs here.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#2a4030", letterSpacing: 2, marginRight: 4 }}>AGENCY</span>
        <button
          type="button"
          onClick={() => setAgency("all")}
          style={{
            fontFamily: RAJ,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            padding: "5px 12px",
            borderRadius: 2,
            cursor: "pointer",
            border: `1px solid ${agency === "all" ? "#00bb66" : "#1a3320"}`,
            background: agency === "all" ? "rgba(0,255,136,0.06)" : "transparent",
            color: agency === "all" ? "#00ff88" : "#5a8068",
          }}
        >
          ALL
        </button>
        {agencies.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAgency(a)}
            style={{
              fontFamily: RAJ,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              padding: "5px 12px",
              borderRadius: 2,
              cursor: "pointer",
              border: `1px solid ${agency === a ? "#ffaa00" : "#1a3320"}`,
              background: agency === a ? "rgba(255,170,0,0.08)" : "transparent",
              color: agency === a ? "#ffaa00" : "#5a8068",
            }}
          >
            {a}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#2a4030", letterSpacing: 2, marginRight: 4 }}>A–Z</span>
        <button
          type="button"
          onClick={() => setLetter(null)}
          style={{
            fontFamily: FONT,
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 2,
            cursor: "pointer",
            border: `1px solid ${letter === null ? "#00bb66" : "#1a3320"}`,
            background: letter === null ? "rgba(0,255,136,0.06)" : "transparent",
            color: letter === null ? "#00ff88" : "#5a8068",
          }}
        >
          ALL
        </button>
        {LETTERS.map((L) => (
          <button
            key={L}
            type="button"
            onClick={() => setLetter(letter === L ? null : L)}
            style={{
              fontFamily: FONT,
              fontSize: 11,
              minWidth: 26,
              padding: "4px 0",
              borderRadius: 2,
              cursor: "pointer",
              border: `1px solid ${letter === L ? "#00bb66" : "#1a3320"}`,
              background: letter === L ? "rgba(0,255,136,0.06)" : "transparent",
              color: letter === L ? "#00ff88" : "#3a5040",
            }}
          >
            {L}
          </button>
        ))}
      </div>

      <input
        value={filterQ}
        onChange={(e) => setFilterQ(e.target.value)}
        placeholder="Filter this list…"
        style={{
          width: "100%",
          maxWidth: "100%",
          marginBottom: 12,
          background: "#090f0b",
          border: "1px solid #1a3320",
          borderRadius: 3,
          padding: "10px 14px",
          color: "#c8e8d0",
          fontFamily: FONT,
          fontSize: 14,
          outline: "none",
        }}
      />

      {loading && (
        <div style={{ color: "#3a5040", fontSize: 12, letterSpacing: 2, padding: "1rem 0" }}>
          [ LOADING INDEX… ]
        </div>
      )}
      {error && (
        <div style={{ padding: 12, border: "1px solid rgba(255,51,51,0.25)", borderRadius: 3, color: "#ff5555", fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div
          style={{
            maxHeight: "min(60vh, 640px)",
            overflowY: "auto",
            border: "1px solid #1a3320",
            borderRadius: 4,
            background: "#080e0a",
          }}
        >
          {documents.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#3a5040", fontSize: 12, letterSpacing: 2 }}>
              NO ENTRIES — TRY ANOTHER LETTER OR AGENCY
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {documents.map((d) => (
                <li
                  key={d.id}
                  style={{
                    borderBottom: "1px solid #0d1a10",
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 10, color: "#ffaa00", border: "1px solid rgba(255,170,0,0.35)", padding: "2px 8px", borderRadius: 2, letterSpacing: 1 }}>
                      {d.agency}
                    </span>
                    {d.year != null && (
                      <span style={{ fontSize: 10, color: "#5a8068", letterSpacing: 1 }}>
                        {d.year}
                      </span>
                    )}
                    <a
                      href={d.canonical_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: RAJ,
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#00ff88",
                        textDecoration: "none",
                        flex: 1,
                        minWidth: 200,
                        lineHeight: 1.35,
                      }}
                    >
                      {d.title} ↗
                    </a>
                  </div>
                  {d.excerpt && (
                    <div style={{ fontFamily: FONT, fontSize: 12, color: "#5a8068", lineHeight: 1.6, paddingLeft: 2 }}>
                      {d.excerpt}
                    </div>
                  )}
                  <div style={{ fontFamily: FONT, fontSize: 11, color: "#2a4030", wordBreak: "break-all" }}>
                    {d.canonical_url}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
