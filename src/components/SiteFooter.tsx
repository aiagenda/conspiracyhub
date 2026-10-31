import Link from "next/link";
import NewsletterSignup from "@/components/NewsletterSignup";

export default function SiteFooter() {
  return <footer className="publication-footer">
    <div className="publication-footer-inner">
      <section className="publication-footer-brief" aria-labelledby="footer-brief-heading">
        <div>
          <p className="publication-eyebrow">Stay in the loop</p>
          <h2 id="footer-brief-heading">The Weekly Oracle Brief.</h2>
          <p>Selected stories, research leads and public records worth a look — once a week, free, unsubscribe in one click.</p>
        </div>
        <NewsletterSignup source="footer" variant="footer" />
      </section>
      <div>
        <span className="publication-footer-name">◈ THE THEORIST</span>
        <span>© {new Date().getFullYear()} · AI INVESTIGATIVE INTELLIGENCE</span>
      </div>
      <nav aria-label="Footer">
        <Link href="/about">Editorial approach</Link>
        <Link href="/data">Data &amp; monitors</Link>
        <Link href="/guide">Guide</Link>
        <Link href="/contact">Contact &amp; corrections</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <a href="https://www.parallelhuman.tech/en" target="_blank" rel="noopener noreferrer">By ParallelHuman ↗</a>
      </nav>
    </div>
  </footer>;
}
