import { pageContentShellStyle } from "@/lib/pageShell";

export const metadata = { title: "Privacy Policy — ConspiracyHub" };

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: "32px 0 10px", fontSize: 16, fontWeight: 700, color: "#d0d0d0", letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 14px", color: "#888", fontSize: 14, lineHeight: 1.75 }}>
      {children}
    </p>
  );
}

export default function PrivacyPage() {
  return (
    <div style={pageContentShellStyle({ maxWidth: 780 })}>
      <p style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.12em", color: "#444", textTransform: "uppercase" }}>Legal</p>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "#e8e8e8" }}>
        Privacy Policy
      </h1>
      <p style={{ margin: "0 0 40px", fontSize: 12, color: "#444" }}>Last updated: May 2026</p>

      <H>1. Overview</H>
      <P>
        ConspiracyHub (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is a research and intelligence aggregation platform. This
        Privacy Policy describes how we handle information collected when you use our website.
        We are committed to respecting your privacy and collecting only what is necessary to
        operate the service.
      </P>

      <H>2. Information We Collect</H>
      <P>
        <strong style={{ color: "#bbb" }}>Usage data.</strong> We collect anonymised page-view events (URL path and a
        one-way hashed, non-identifiable fingerprint of your IP address). This data is used
        solely for aggregate analytics and is automatically deleted after 60 days.
      </P>
      <P>
        <strong style={{ color: "#bbb" }}>Contact messages.</strong> When you submit the contact form we store your
        name, email address, selected category, subject, and message. This information is
        used only to respond to your inquiry and is not shared with third parties.
      </P>
      <P>
        <strong style={{ color: "#bbb" }}>Community content.</strong> If you participate in community threads, the text
        you submit is stored in our database. We do not require account registration —
        participation is pseudonymous.
      </P>
      <P>
        <strong style={{ color: "#bbb" }}>Cookies &amp; local storage.</strong> We use browser <code>localStorage</code> to
        remember your voting preferences within the community (no tracking cookies are used).
      </P>

      <H>3. How We Use Your Information</H>
      <P>
        We use the collected data to operate and improve the platform, respond to contact
        inquiries, detect abuse, and understand aggregate usage patterns. We do not sell,
        rent, or trade your information to any third party.
      </P>

      <H>4. Third-Party Services</H>
      <P>
        We use the following external services which may process data on your behalf:
        <br />— <strong style={{ color: "#bbb" }}>Supabase</strong> (database &amp; authentication infrastructure)<br />
        — <strong style={{ color: "#bbb" }}>OpenAI</strong> (AI analysis of article content — no personal data is sent)<br />
        — <strong style={{ color: "#bbb" }}>Tenor</strong> (GIF search within community threads)<br />
        — <strong style={{ color: "#bbb" }}>Vercel</strong> (hosting &amp; edge delivery)
      </P>

      <H>5. Data Retention</H>
      <P>
        Page-view and API logs are automatically purged after 60 days. Contact messages are
        retained for up to 12 months and then deleted. Community posts may be retained
        indefinitely unless you request removal.
      </P>

      <H>6. Your Rights</H>
      <P>
        You may request access to, correction of, or deletion of any personal data we hold
        about you by submitting a request via our{" "}
        <a href="/contact" style={{ color: "#6bc46b", textDecoration: "none" }}>contact form</a>.
        We will respond within 30 days.
      </P>

      <H>7. Security</H>
      <P>
        All data is stored in encrypted databases hosted within the EU. Access is restricted
        via row-level security policies and API keys. We follow industry-standard practices
        to protect your data.
      </P>

      <H>8. Changes to This Policy</H>
      <P>
        We may update this policy from time to time. Significant changes will be announced
        via a banner on the platform. Continued use after the effective date constitutes
        acceptance.
      </P>

      <H>9. Contact</H>
      <P>
        For privacy-related questions, please use our{" "}
        <a href="/contact" style={{ color: "#6bc46b", textDecoration: "none" }}>contact form</a>{" "}
        and select the &quot;Support / Bug&quot; category.
      </P>
    </div>
  );
}
