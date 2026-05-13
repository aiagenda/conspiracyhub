import type { Metadata } from "next";
import { Rajdhani, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import PageTracker from "@/components/PageTracker";
import SendFeedbackWidget from "@/components/SendFeedbackWidget";

const raj = Rajdhani({
  variable: "--font-raj",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

const mono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  weight: "400",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://conspiracyhub.vercel.app";

const OG_DESCRIPTION =
  "AI-curated conspiracy investigation feed. GPT-4o scores and ranks the most significant government cover-ups, UAP sightings, classified patent secrets, and underground theories — updated daily.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "The Theorist — AI Conspiracy Investigation Feed",
    template: "%s | The Theorist",
  },
  description: OG_DESCRIPTION,
  keywords: [
    "conspiracy theories",
    "UAP",
    "UFO",
    "government cover-up",
    "AI news feed",
    "declassified documents",
    "deep state",
    "classified secrets",
    "investigative intelligence",
    "FOIA",
  ],
  authors: [{ name: "The Theorist", url: SITE_URL }],
  creator: "The Theorist",
  publisher: "The Theorist",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "The Theorist",
    title: "The Theorist — AI Conspiracy Investigation Feed",
    description: OG_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "The Theorist — AI Conspiracy Investigation Feed",
    description: OG_DESCRIPTION,
    site: "@TheTheoristAI",
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${raj.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <PageTracker />
        <main id="main-content" className="flex flex-1 flex-col outline-none">
          {children}
        </main>
        <SendFeedbackWidget />
        <SiteFooter />
      </body>
    </html>
  );
}
