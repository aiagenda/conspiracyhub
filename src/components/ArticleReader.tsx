"use client";
import EditorialReader from "@/components/EditorialReader";
import type { NewsItem } from "@/types";
import type { VoteTheoryChip } from "@/lib/oracleVoteTheories";
export default function ArticleReader({ item, body, bodyMarkdown, sourceAttribution, initialChatOpen = false, voteTheories = [], bodyKind = "source", updatedAt }: {
  item: NewsItem; body: string; bodyMarkdown?: string;
  sourceAttribution?: { label: string; url: string; isRewritten?: boolean };
  initialChatOpen?: boolean; voteTheories?: VoteTheoryChip[];
  bodyKind?: "source" | "summary"; updatedAt?: string;
}) {
  const sources = sourceAttribution ? [{ title: sourceAttribution.label, url: sourceAttribution.url, description: sourceAttribution.isRewritten ? "Original reporting used for this AI-assisted analysis. Consult the publisher for the complete account." : "Original source for this story." }] : [];
  return <EditorialReader item={item} body={body} markdown={bodyMarkdown} sources={sources} initialChatOpen={initialChatOpen} voteTheories={voteTheories} bodyKind={bodyKind} updatedAt={updatedAt} />;
}
