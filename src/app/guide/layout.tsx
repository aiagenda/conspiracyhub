import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investigation Guide",
  description:
    "How to use The Theorist: FEED, ANALYSIS reports (/blog), Investigation Board, Oracle AI, UAP files, outbreaks, community, and search.",
  openGraph: {
    title: "Investigation Guide | The Theorist",
    description:
      "Platform guide — navigation, feed vs analysis reports, Investigation Board, Oracle, and research tools.",
  },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
