-- Optional FAQ pairs for FAQPage JSON-LD (also mirrored in ## FAQ markdown section).
alter table public.generated_articles
  add column if not exists faqs jsonb not null default '[]'::jsonb;
