import Link from "next/link";
import { pageContentShellStyle } from "@/lib/pageShell";
import { newsletterAdmin } from "@/lib/server/newsletter";

export const metadata = { title: "Subscription confirmed — The Theorist" };
export const dynamic = "force-dynamic";

export default async function ConfirmNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();

  let confirmed = false;
  if (token) {
    const { data } = await newsletterAdmin()
      .from("newsletter_subscribers")
      .update({ confirmed_at: new Date().toISOString(), unsubscribed_at: null })
      .eq("token", token)
      .select("email");
    confirmed = Boolean(data?.length);
  }

  return (
    <div style={pageContentShellStyle({ maxWidth: 640 })}>
      <p style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.12em", color: "#444", textTransform: "uppercase" }}>
        Weekly Oracle Brief
      </p>
      <h1 style={{ margin: "0 0 14px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "#e8e8e8" }}>
        {confirmed ? "You’re on the list." : "That link has expired."}
      </h1>
      <p style={{ margin: "0 0 24px", color: "#888", fontSize: 14, lineHeight: 1.75 }}>
        {confirmed
          ? "The briefing goes out once a week: selected stories, research leads and public records worth a look. Every issue carries a one-click unsubscribe."
          : "The confirmation link is either already used up or no longer valid. Subscribe again from the foot of any page and a fresh one will be on its way."}
      </p>
      <Link href="/" style={{ color: "#00bb66", fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        ← Back to the feed
      </Link>
    </div>
  );
}
