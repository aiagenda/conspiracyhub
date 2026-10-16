"use client";
import EditorialReader from "@/components/EditorialReader";
import type { VoteTheoryChip } from "@/lib/oracleVoteTheories";
import type { NewsItem } from "@/types";
export default function GeneratedArticleReader({ item, slug, markdown, sources = [], initialChatOpen = false, voteTheories = [], mode, updatedAt, sourcePublishedAt, checkedAt, reviewMethod }: {
  item: NewsItem; slug: string; markdown: string;
  sources?: Array<{ title: string; url: string; description: string }>;
  initialChatOpen?: boolean; voteTheories?: VoteTheoryChip[]; mode?: string; updatedAt?: string; sourcePublishedAt?: string; checkedAt?: string; reviewMethod?: string;
}) {
  return <EditorialReader item={item} generatedSlug={slug} markdown={markdown} sources={sources} initialChatOpen={initialChatOpen} voteTheories={voteTheories} hypothesis={mode === "lore_dossier"} updatedAt={updatedAt} sourcePublishedAt={sourcePublishedAt} checkedAt={checkedAt} reviewMethod={reviewMethod} />;
}
