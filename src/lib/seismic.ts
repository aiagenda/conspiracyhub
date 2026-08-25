export type SeismicSource = "usgs" | "emsc";

export type SeismicEvent = {
  id: string;
  title: string;
  place: string;
  mag: number;
  magType: string;
  time: string;
  lat: number;
  lng: number;
  depthKm: number | null;
  tsunami: boolean;
  felt: number | null;
  /** USGS PAGER alert: green | yellow | orange | red */
  pager: string | null;
  significance: number;
  status: string;
  type: string;
  url: string;
  sources: SeismicSource[];
  significant: boolean;
};

export type SeismicFeedStatus = {
  id: string;
  label: string;
  ok: boolean;
  count: number;
  error?: string;
};

export type SeismicPayload = {
  events: SeismicEvent[];
  feeds: SeismicFeedStatus[];
  generated_at: string;
  stats: {
    total: number;
    last24h: number;
    m45: number;
    m5: number;
    m6: number;
    tsunami: number;
    significant: number;
  };
};

export function magColor(mag: number): string {
  if (mag >= 7) return "#ff2222";
  if (mag >= 6) return "#ff3333";
  if (mag >= 5) return "#ff6633";
  if (mag >= 4.5) return "#ffaa00";
  if (mag >= 3.5) return "#c8a040";
  return "#5a8068";
}

export function magBand(mag: number): string {
  if (mag >= 7) return "MAJOR";
  if (mag >= 6) return "STRONG";
  if (mag >= 5) return "MODERATE";
  if (mag >= 4.5) return "LIGHT";
  return "MINOR";
}

export function seismicTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function isM5PlusLast24h(e: SeismicEvent): boolean {
  return e.mag >= 5 && Date.now() - new Date(e.time).getTime() < 24 * 3600_000;
}
