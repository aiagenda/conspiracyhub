import { pageContentShellStyle } from "@/lib/pageShell";
import UnsubscribeButton from "@/components/UnsubscribeButton";

export const metadata = { title: "Unsubscribe — The Theorist" };
export const dynamic = "force-dynamic";

/**
 * Leaving the list takes a deliberate click, not a page load: mail clients and
 * security scanners follow links in a message on the recipient's behalf, and one
 * of those should not quietly unsubscribe them.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();

  return (
    <div style={pageContentShellStyle({ maxWidth: 640 })}>
      <p style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.12em", color: "#444", textTransform: "uppercase" }}>
        Weekly Oracle Brief
      </p>
      <h1 style={{ margin: "0 0 14px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "#e8e8e8" }}>
        Stop the weekly briefing?
      </h1>
      <UnsubscribeButton token={token} />
    </div>
  );
}
