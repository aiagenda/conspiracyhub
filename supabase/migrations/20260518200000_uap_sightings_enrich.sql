-- UAP sightings: images, content kind, excerpt flag
alter table public.uap_sightings
  add column if not exists image_url text,
  add column if not exists content_kind text not null default 'report'
    check (content_kind in ('report', 'blog', 'case')),
  add column if not exists description_is_excerpt boolean not null default false;
