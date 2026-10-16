"use client";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { READER_REACTION_VOTE_TYPE, type ReaderReactionStats } from "@/lib/readerReactionVote";
interface VoteData { vote_type: string; vote_count: number; avg_value: number }
type Props = { articleId?: string; generatedArticleId?: string; aiScore?: number; theories?: Array<{ name: string; probability: number }> };
export default function VotePanel({ articleId, generatedArticleId, theories = [] }: Props) {
  const target = articleId ? { article_id: articleId } : { generated_article_id: generatedArticleId ?? "" };
  const targetId = articleId || generatedArticleId;
  const [votes, setVotes] = useState<VoteData[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  const [reaction, setReaction] = useState<ReaderReactionStats>({ score: 0, up: 0, down: 0 });
  const [myReaction, setMyReaction] = useState(0);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const query = articleId ? `article_id=${encodeURIComponent(articleId)}` : `generated_article_id=${encodeURIComponent(generatedArticleId ?? "")}`;
  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    fetch(`/api/vote?${query}`).then(async response => { if (!response.ok) throw new Error("Reader responses are unavailable."); return response.json(); }).then(data => {
      if (cancelled) return;
      setVotes(data.aggregates ?? []); setReaction(data.reader_reaction ?? { score: 0, up: 0, down: 0 }); setMyReaction(data.my_reader_reaction ?? 0);
      setMyVotes(Object.fromEntries((data.my_votes ?? []).map((vote: { vote_type: string; value: number }) => [vote.vote_type, vote.value])));
    }).catch(() => { if (!cancelled) setError("Reader responses are unavailable. Please try again later."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, targetId]);
  async function castVote(vote_type: string, value: number) {
    if (voting || !targetId) return;
    setVoting(true); setError(""); setConfirmation("");
    try {
      const response = await fetch("/api/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, vote_type, value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Your response could not be saved. Please try again.");
      if (data.aggregates) setVotes(data.aggregates);
      if (data.reader_reaction) setReaction(data.reader_reaction);
      if (vote_type === READER_REACTION_VOTE_TYPE) setMyReaction(data.my_reader_reaction ?? value);
      else setMyVotes(current => ({ ...current, [vote_type]: value }));
      setConfirmation(value === 0 ? "Response removed." : "Your response was saved.");
      posthog.capture("article_vote_cast", { ...target, vote_type, value });
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save your response."); }
    finally { setVoting(false); }
  }
  if (!targetId) return null;
  const total = reaction.up + reaction.down;
  return <section className="editorial-sidebar-section editorial-reader-votes" aria-label="Reader responses"><h2>Was this worth reading?</h2><p>Reader reactions express opinion. They do not establish whether a claim is true.</p><div className="editorial-reaction-buttons"><button type="button" aria-pressed={myReaction === 1} disabled={loading || voting} onClick={() => void castVote(READER_REACTION_VOTE_TYPE, myReaction === 1 ? 0 : 1)}>↑ Upvote <span>{reaction.up}</span></button><button type="button" aria-pressed={myReaction === -1} disabled={loading || voting} onClick={() => void castVote(READER_REACTION_VOTE_TYPE, myReaction === -1 ? 0 : -1)}>↓ Downvote <span>{reaction.down}</span></button></div><p className="editorial-reaction-count">{loading ? "Loading reader responses…" : total === 0 ? "No reader reactions yet." : `${total} ${total === 1 ? "reader reaction" : "reader reactions"}`}</p>
    {theories.length ? <details className="editorial-theory-votes"><summary>Reader interpretations</summary><p>Which interpretation would you investigate further? These are reader preferences, not corroboration.</p>{theories.slice(0, 3).map((theory, index) => { const key = `theory_${index}`; const count = votes.find(vote => vote.vote_type === key)?.vote_count ?? 0; return <button key={key} type="button" className="editorial-theory-choice" disabled={loading || voting || Boolean(myVotes[key])} onClick={() => void castVote(key, 1)}><span>{theory.name}</span><small>{myVotes[key] ? "Selected · " : ""}{count} votes</small></button>; })}</details> : null}
    <details className="editorial-theory-votes"><summary>Related experience</summary><p>Personal accounts are unverified until independently checked.</p><button type="button" className="publication-button publication-button-quiet" disabled={loading || voting || Boolean(myVotes.witnessed)} onClick={() => void castVote("witnessed", 1)}>{myVotes.witnessed ? "Your experience is noted" : "I have a related experience"}</button>{(votes.find(vote => vote.vote_type === "witnessed")?.vote_count ?? 0) > 0 ? <p>{votes.find(vote => vote.vote_type === "witnessed")?.vote_count} unverified reader reports</p> : null}</details>
    {error ? <p role="alert">{error}</p> : null}<span role="status" className="editorial-action-status">{confirmation}</span>
  </section>;
}
