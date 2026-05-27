import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investigation Guide",
  description:
    "How to use The Theorist: FEED, highest impact signal, Insider Radar, ANALYSIS reports (/blog), Investigation Board, federal spending, Oracle AI, UAP files, outbreaks, account, and search.",
  openGraph: {
    title: "Investigation Guide | The Theorist",
    description:
    "Platform guide — navigation, feed, highest impact signal, Investigation Board, federal spending, Oracle AI, Analyst Pass, saved investigations, and email briefing.",
  },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
