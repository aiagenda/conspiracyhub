import UAPTracker from "@/components/UAPTracker";
export const metadata = {
  title: "UAP Intelligence",
  description: "Investigate UAP and UFO sightings worldwide. AI-cross-referenced incident database with declassified military reports, witness testimony, and government FOIA records.",
  openGraph: {
    title: "UAP Intelligence | The Theorist",
    description: "AI-cross-referenced UAP incident database with declassified military reports, witness testimony, and FOIA records.",
  },
};
export default function UAPPage() { return <UAPTracker />; }
