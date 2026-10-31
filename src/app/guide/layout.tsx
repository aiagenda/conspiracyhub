import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investigation Guide",
  description:
    "How to use The Theorist: FEED, highest impact signal, Insider Radar, ANALYSIS reports (/blog), Investigation Board, federal spending, Oracle AI, UAP files, outbreaks, seismic monitor, the document index, and search.",
  openGraph: {
    title: "Investigation Guide | The Theorist",
    description:
    "Platform guide — navigation, feed, highest impact signal, Investigation Board, federal spending, Oracle AI, the declassified document index, and the weekly briefing.",
  },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
