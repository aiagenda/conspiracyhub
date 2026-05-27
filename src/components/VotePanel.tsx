"use client";
import { useEffect, useState } from "react";
import posthog from "posthog-js";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ  = "var(--font-raj), sans-serif";

interface VoteData {
  vote_type: string;
  vote_count: number;
  avg_value: number;
}

interface Props {
  articleId?: string;
  generatedArticleId?: string;
  aiScore: number;
  theories?: Array<{ name: string; probability: number }>;
}

export default function VotePanel({ articleId, generatedArticleId, aiScore, theories = [] }: Props) {
  const aid = (articleId ?? "").toString().trim();
  const gid = (generatedArticleId ?? "").toString().trim();
  const isGenerated = aid.length === 0 && gid.length > 0;
  const targetId = aid.length > 0 ? aid : gid;
  const [votes, setVotes] = useState<VoteData[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [witnessed, setWitnessed] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null); // tracks which type just got confirmed

  useEffect(() => {
    if (!targetId) {
      setLoading(false);
      return;
    }
    const q = isGenerated
      ? `generated_article_id=${encodeURIComponent(targetId)}`
      : `article_id=${encodeURIComponent(targetId)}`;
    fetch(`/api/vote?${q}`)
      .then(r => r.json())
      .then(d => {
        setVotes(d.aggregates ?? []);
        const mv: Record<string, number> = {};
        (d.my_votes ?? []).forEach((v: { vote_type: string; value: number }) => { mv[v.vote_type] = v.value; });
        setMyVotes(mv);
        setWitnessed(!!mv["witnessed"]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [targetId, isGenerated]);

  async function castVote(vote_type: string, value: number) {
    if (voting || !targetId) return;
    setVoting(vote_type);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isGenerated
            ? { generated_article_id: targetId, vote_type, value }
            : { article_id: targetId, vote_type, value },
        ),
      });
      const d = await res.json();
      if (!res.ok) {
        console.warn("[VotePanel]", d.error ?? res.statusText);
        return;
      }
      if (d.aggregates) setVotes(d.aggregates);
      setMyVotes((p) => ({ ...p, [vote_type]: value }));
      if (vote_type === "witnessed") setWitnessed(true);
      setConfirmed(vote_type);
      setTimeout(() => setConfirmed(null), 1400);
      posthog.capture("article_vote_cast", {
        vote_type,
        value,
        article_id: aid || undefined,
        generated_article_id: gid || undefined,
      });
    } catch {}
    setVoting(null);
  }

  function getAgg(type: string) {
    return votes.find(v => v.vote_type === type);
  }

  const conspAgg = getAgg("conspiracy_score");
  const witnessAgg = getAgg("witnessed");
  const communityScore = conspAgg ? conspAgg.avg_value : null;
  const totalVoters = conspAgg ? conspAgg.vote_count : 0;

  if (!targetId) return null;

  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden" }}>
      <style>{`
        @keyframes bannerDot{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes voteConfirm{0%{opacity:0;transform:translateY(-4px)}15%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0}}
      `}</style>

      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", animation: "bannerDot 2s infinite" }} />
        <div style={{ fontFamily: FONT, fontSize: 9, color: "#00bb66", letterSpacing: 2 }}>◈ READER VOTES</div>
        {totalVoters > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 9, color: "#3a5040", letterSpacing: 1 }}>{totalVoters} VOTERS</span>
        )}
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* AI vs Community score comparison */}
        <div>
          <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>Threat Score Comparison</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            {/* AI score */}
            <div style={{ flex: 1, border: "1px solid #1a3320", borderRadius: 3, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: "#5a8068", letterSpacing: 2, marginBottom: 4 }}>AI SCORE</div>
              <div style={{ fontFamily: RAJ, fontSize: 24, fontWeight: 700, color: aiScore >= 65 ? "#ff3333" : aiScore >= 40 ? "#ffaa00" : "#00bb66", lineHeight: 1 }}>{aiScore}%</div>
            </div>
            {/* Community score */}
            <div style={{ flex: 1, border: `1px solid ${communityScore ? "#00bb66" : "#1a3320"}`, borderRadius: 3, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: "#5a8068", letterSpacing: 2, marginBottom: 4 }}>READERS</div>
              {loading ? (
                <div style={{ fontFamily: RAJ, fontSize: 24, fontWeight: 700, color: "#3a5040", lineHeight: 1 }}>—</div>
              ) : communityScore ? (
                <div style={{ fontFamily: RAJ, fontSize: 24, fontWeight: 700, color: Number(communityScore) >= 65 ? "#ff3333" : Number(communityScore) >= 40 ? "#ffaa00" : "#00bb66", lineHeight: 1 }}>{communityScore}%</div>
              ) : (
                <div style={{ fontSize: 9, color: "#3a5040", marginTop: 4 }}>Be first →</div>
              )}
            </div>
          </div>

          {/* Community score slider */}
          {!myVotes["conspiracy_score"] ? (
            <div>
              <div style={{ fontSize: 9, color: "#5a8068", marginBottom: 6, letterSpacing: 1 }}>How suspicious do you think this is?</div>
              <div className="vote-chips" style={{ display: "flex", gap: 4 }}>
                {[10, 25, 40, 55, 70, 85, 95].map(val => {
                  const col = val >= 65 ? "#ff3333" : val >= 40 ? "#ffaa00" : "#00bb66";
                  return (
                    <button key={val} onClick={() => castVote("conspiracy_score", val)}
                      disabled={!!voting}
                      style={{ flex: 1, padding: "5px 2px", background: "transparent", border: `1px solid ${col}22`, borderRadius: 2, color: col, fontFamily: RAJ, fontSize: 10, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", opacity: voting ? 0.5 : 1 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${col}18`; (e.currentTarget as HTMLButtonElement).style.borderColor = col; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.borderColor = `${col}22`; }}>
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, color: "#00bb66", letterSpacing: 1 }}>✓ You voted {myVotes["conspiracy_score"]}%</span>
              {confirmed === "conspiracy_score" && (
                <span style={{ fontSize: 9, color: "#00ff88", letterSpacing: 1, animation: "voteConfirm 1.4s ease forwards" }}>RECORDED</span>
              )}
            </div>
          )}
        </div>

        {/* Theory voting */}
        {theories.length > 0 && (
          <div>
            <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>Which theory is most credible?</div>
            {theories.slice(0, 3).map((t, i) => {
              const key = `theory_${i}`;
              const voted = !!myVotes[key];
              const agg = getAgg(key);
              return (
                <button key={i} onClick={() => !voted && castVote(key, 1)}
                  disabled={!!voting || voted}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 5, background: voted ? "rgba(201,77,255,0.08)" : "transparent", border: `1px solid ${voted ? "#c94dff" : "#1a3320"}`, borderRadius: 3, cursor: voted ? "default" : "pointer", transition: "all 0.15s", textAlign: "left" }}
                  onMouseEnter={e => { if (!voted) { (e.currentTarget as HTMLButtonElement).style.borderColor = "#c94dff"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(201,77,255,0.04)"; }}}
                  onMouseLeave={e => { if (!voted) { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: voted ? "#c94dff" : "#1a3320", flexShrink: 0 }} />
                  <span style={{ fontFamily: FONT, fontSize: 10, color: voted ? "#e9b3ff" : "#7aaa8a", flex: 1, lineHeight: 1.4 }}>{t.name.slice(0, 50)}{t.name.length > 50 ? "…" : ""}</span>
                  {confirmed === key && <span style={{ fontSize: 9, color: "#c94dff", letterSpacing: 1, animation: "voteConfirm 1.4s ease forwards" }}>✓</span>}
                  {agg && confirmed !== key && <span style={{ fontSize: 9, color: "#c94dff", flexShrink: 0 }}>{agg.vote_count} votes</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Witnessed button */}
        <button
          onClick={() => !witnessed && castVote("witnessed", 1)}
          disabled={witnessed || !!voting}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: witnessed ? "rgba(255,170,0,0.08)" : "transparent", border: `1px solid ${witnessed ? "#ffaa00" : "#1a3320"}`, borderRadius: 3, cursor: witnessed ? "default" : "pointer", transition: "all 0.15s", width: "100%" }}
          onMouseEnter={e => { if (!witnessed) { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ffaa00"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,170,0,0.04)"; }}}
          onMouseLeave={e => { if (!witnessed) { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}}>
          <span style={{ fontSize: 14 }}>{witnessed ? "✓" : "👁"}</span>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: witnessed ? "#ffaa00" : "#c8e8d0", letterSpacing: 1 }}>
                {witnessed ? "YOU WITNESSED THIS" : "I WITNESSED SOMETHING SIMILAR"}
              </span>
              {confirmed === "witnessed" && (
                <span style={{ fontSize: 9, color: "#ffaa00", letterSpacing: 1, animation: "voteConfirm 1.4s ease forwards" }}>CONFIRMED</span>
              )}
            </div>
            {witnessAgg && witnessAgg.vote_count > 0 && (
              <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>{witnessAgg.vote_count} others confirmed</div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
