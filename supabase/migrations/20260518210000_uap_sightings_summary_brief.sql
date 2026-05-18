-- Intelligence brief for long NUFORC posts (display default; full text still in description)
alter table public.uap_sightings
  add column if not exists summary_brief text;
