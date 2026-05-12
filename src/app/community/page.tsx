import { Suspense } from "react";
import CommunityBoard from "@/components/CommunityBoard";

export const metadata = { title: "Community Intelligence — The Theorist" };

function CommunityFallback() {
  return (
    <div style={{ minHeight: "50vh", background: "#050c07", color: "#3a5040", fontFamily: "var(--font-share-tech-mono), monospace", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, letterSpacing: 2 }}>
      LOADING COMMUNITY…
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<CommunityFallback />}>
      <CommunityBoard />
    </Suspense>
  );
}
