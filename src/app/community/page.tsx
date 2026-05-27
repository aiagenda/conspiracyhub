import { redirect } from "next/navigation";
import { Suspense } from "react";
import CommunityBoard from "@/components/CommunityBoard";
import { SHOW_COMMUNITY } from "@/lib/featureFlags";

export const metadata = {
  title: "Community Intelligence",
  description: "Join the investigation. Share theories, discuss declassified documents, and connect with other researchers in The Theorist's live community board.",
  openGraph: {
    title: "Community Intelligence | The Theorist",
    description: "Share theories, discuss declassified documents, and connect with other investigators in real time.",
  },
};

function CommunityFallback() {
  return (
    <div style={{ minHeight: "50vh", background: "#050c07", color: "#3a5040", fontFamily: "var(--font-share-tech-mono), monospace", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, letterSpacing: 2 }}>
      LOADING COMMUNITY…
    </div>
  );
}

export default function CommunityPage() {
  if (!SHOW_COMMUNITY) redirect("/");

  return (
    <Suspense fallback={<CommunityFallback />}>
      <CommunityBoard />
    </Suspense>
  );
}
