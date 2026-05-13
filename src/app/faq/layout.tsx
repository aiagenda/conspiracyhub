import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about The Theorist — how the AI investigation feed works, what sources we monitor, and how to get the most out of the platform.",
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
