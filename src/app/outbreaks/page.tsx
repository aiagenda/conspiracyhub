import OutbreakTracker from "@/components/OutbreakTracker";

export const metadata = {
  title: "Outbreak Tracker",
  description: "Live AI-powered disease outbreak intelligence. Track emerging biological threats, anomalous illness clusters, and suppressed health data worldwide.",
  openGraph: {
    title: "Outbreak Tracker | The Theorist",
    description: "Live AI-powered disease outbreak intelligence. Track emerging biological threats and suppressed health data worldwide.",
  },
};

export default function OutbreaksPage() {
  return <OutbreakTracker />;
}
