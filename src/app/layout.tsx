import type { Metadata } from "next";
import { IBM_Plex_Sans, Rajdhani, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import "./publication.css";
import "./intelligence-reader.css";
import "./intelligence-desk.css";
import { getSiteUrl } from "@/lib/siteUrl";
import SiteFooter from "@/components/SiteFooter";
import PageTracker from "@/components/PageTracker";
import SendFeedbackWidget from "@/components/SendFeedbackWidget";

const raj = Rajdhani({
  variable: "--font-raj",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

// Body typeface for article prose. Before this the reading column fell back to a
// hardcoded Arial: no reading face was ever loaded, only the Rajdhani display font
// and a monospace. Plex Sans holds up at 19px on a dark background.
const body = IBM_Plex_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const mono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  weight: "400",
  subsets: ["latin"],
});

const SITE_URL = getSiteUrl();

const OG_DESCRIPTION =
  "News, analysis and public records on technology, surveillance, institutional power and unexplained events. Explore the story and inspect the evidence.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "The Theorist — AI Investigative Intelligence",
    template: "%s | The Theorist",
  },
  description: OG_DESCRIPTION,
  keywords: [
    "conspiracy theories",
    "UAP",
    "UFO",
    "public accountability",
    "AI news feed",
    "declassified documents",
    "institutional power",
    "public records",
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
    title: "The Theorist — AI Investigative Intelligence",
    description: OG_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "The Theorist — AI Investigative Intelligence",
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
      className={`${raj.variable} ${body.variable} ${mono.variable} h-full antialiased`}
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
