import SeismicTracker from "@/components/SeismicTracker";

export const metadata = {
  title: "Seismic Monitor",
  description:
    "Live global earthquake monitor. USGS and EMSC feeds — magnitude, depth, tsunami flags, and significant events on a world map.",
  openGraph: {
    title: "Seismic Monitor | The Theorist",
    description: "Live USGS + EMSC earthquake feed with magnitude filters and tsunami flags.",
  },
};

export default function SeismicPage() {
  return <SeismicTracker />;
}
