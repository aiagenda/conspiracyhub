import Link from "next/link";
import SiteNav from "@/components/SiteNav";

export default function PublicationHeader({ section }: { section?: string }) {
  return <header className="publication-header intelligence-masthead"><div className="publication-header-inner">
    <Link href="/" className="desk-brand" aria-label="The Theorist — home">
      <svg className="desk-brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 3 38 35H2L20 3Z" stroke="currentColor" strokeWidth="1.2"/><path d="M8 23s5-7 12-7 12 7 12 7-5 7-12 7S8 23 8 23Z" stroke="currentColor" strokeWidth="1.2"/><circle cx="20" cy="23" r="4" fill="currentColor"/><path d="M20 0v6M0 35h6M34 35h6" stroke="currentColor"/></svg>
      <span><strong>THE THEORIST</strong><small>{section ?? "AI INVESTIGATIVE INTELLIGENCE"}</small></span>
    </Link>
    <SiteNav />
  </div></header>;
}
