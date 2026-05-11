import { pageContentShellStyle } from "@/lib/pageShell";

export const metadata = { title: "Terms of Service — ConspiracyHub" };

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

export default function TermsPage() {
  return (
    <div style={pageContentShellStyle({ maxWidth: 780 })}>
      <p style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.12em", color: "#444", textTransform: "uppercase" }}>Legal</p>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "#e8e8e8" }}>
        Terms of Service
      </h1>
      <p style={{ margin: "0 0 40px", fontSize: 12, color: "#444" }}>Last updated: May 2026</p>

      <H>1. Acceptance</H>
      <P>
        By accessing or using ConspiracyHub (&quot;the platform&quot;) you agree to be bound by
        these Terms of Service. If you do not agree, please do not use the platform.
      </P>

      <H>2. Description of Service</H>
      <P>
        ConspiracyHub is an intelligence aggregation platform that curates, analyses, and
        presents publicly available news, documents, and research related to geopolitical
        events, UAP incidents, outbreaks, and related topics. Content is aggregated from
        third-party sources; we do not originate or verify every claim.
      </P>

      <H>3. Use of the Platform</H>
      <P>
        You agree to use the platform for lawful purposes only. You must not:
        <br />— submit false, misleading, or harmful content in community features;
        <br />— attempt to circumvent rate limits, authentication, or security controls;
        <br />— scrape or reproduce platform content at scale without written permission;
        <br />— use the platform to harass, defame, or threaten any individual or group.
      </P>

      <H>4. Community Content</H>
      <P>
        By submitting content to community threads you grant us a non-exclusive, royalty-free
        licence to display and moderate that content within the platform. You retain
        ownership of your content. We reserve the right to remove any content that violates
        these terms.
      </P>

      <H>5. AI-Generated Analysis</H>
      <P>
        Threat scores, Oracle analysis, and AI-generated summaries are provided for
        informational and entertainment purposes only. They do not constitute professional
        advice of any kind (legal, medical, security, or otherwise). Do not make
        real-world decisions based solely on AI-generated content.
      </P>

      <H>6. Third-Party Content &amp; Links</H>
      <P>
        The platform links to and displays content from third-party sources. We are not
        responsible for the accuracy, legality, or availability of external content.
        Links to declassified documents point to official government archives and are
        provided for reference only.
      </P>

      <H>7. Intellectual Property</H>
      <P>
        The ConspiracyHub brand, interface design, and original software are our intellectual
        property. Third-party content remains the property of its respective owners.
        Fair use of aggregated news headlines and excerpts is claimed under applicable law.
      </P>

      <H>8. Disclaimers</H>
      <P>
        The platform is provided &quot;as is&quot; without warranties of any kind. We do not
        guarantee uptime, accuracy, or completeness of information. To the maximum extent
        permitted by law, we disclaim all liability for damages arising from use of
        the platform.
      </P>

      <H>9. Changes to These Terms</H>
      <P>
        We may update these terms at any time. Continued use after a change constitutes
        acceptance. Material changes will be announced on the platform.
      </P>

      <H>10. Contact</H>
      <P>
        Legal inquiries may be submitted via our{" "}
        <a href="/contact" style={{ color: "#6bc46b", textDecoration: "none" }}>contact form</a>.
      </P>
    </div>
  );
}
