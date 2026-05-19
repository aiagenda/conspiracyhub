import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investigation Guide",
  description:
    "How to use The Theorist: FEED, Insider Radar, ANALYSIS reports (/blog), Investigation Board, Oracle AI, UAP files, outbreaks, community, and search.",
  openGraph: {
    title: "Investigation Guide | The Theorist",
    description:
      "Platform guide — navigation, feed, Insider Radar, Investigation Board, Oracle, Analyst Pass trial, and research tools.",
  },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
