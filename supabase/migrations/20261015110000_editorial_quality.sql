-- Publication checks describe evidence review; they are not a claim of objective truth.
alter table public.generated_articles
  add column if not exists editorial_checks jsonb,
  add column if not exists source_published_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists updated_at timestamptz;
-- Preserve the original timeline; migration time is not an editorial update.
update public.generated_articles set updated_at = coalesce(published_at, created_at, now()) where updated_at is null;
alter table public.generated_articles alter column updated_at set default now(), alter column updated_at set not null;
alter table public.generated_articles alter column status set default 'draft';

create or replace function public.touch_generated_article_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  -- Editing reviewed prose invalidates its previous evidence checks.
  if new.content is distinct from old.content or new.title is distinct from old.title
    or new.sources is distinct from old.sources or new.excerpt is distinct from old.excerpt
    or new.source_published_at is distinct from old.source_published_at then
    if new.editorial_checks is not distinct from old.editorial_checks then
      new.editorial_checks = null;
      new.verified_at = null;
      new.status = 'draft';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists generated_article_updated_at on public.generated_articles;
create trigger generated_article_updated_at before update on public.generated_articles
for each row execute function public.touch_generated_article_updated_at();

-- The old all-roles policy also exposed drafts. Limit backend access to service_role.
drop policy if exists "Service role full access" on public.generated_articles;
create policy "Service role full access" on public.generated_articles
  for all to service_role using (true) with check (true);
