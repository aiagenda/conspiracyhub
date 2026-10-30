import posthog from "posthog-js";

const SUPPRESS_KEY = "theorist_analytics_suppress";

function suppressOwnTraffic(): boolean {
  try {
    const onAdmin = window.location.pathname.startsWith("/admin");
    if (onAdmin) localStorage.setItem(SUPPRESS_KEY, "1");
    return onAdmin || localStorage.getItem(SUPPRESS_KEY) === "1";
  } catch {
    return false;
  }
}

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
if (token && process.env.NODE_ENV === "production") {
  const ownBrowser = suppressOwnTraffic();
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: false,
    opt_out_capturing_by_default: ownBrowser,
  });
  if (ownBrowser) posthog.opt_out_capturing();
}
