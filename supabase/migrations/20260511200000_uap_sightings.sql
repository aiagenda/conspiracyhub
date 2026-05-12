-- UAP/UFO sightings scraped from NUFORC and other public sources

create table if not exists uap_sightings (
  id uuid default gen_random_uuid() primary key,
  source text not null default 'nuforc',           -- 'nuforc' | 'mufon' | 'aaro' | 'manual'
  source_id text,                                  -- original ID at source for dedup
  source_url text,
  title text not null,
  description text not null,
  location_name text,                              -- human-readable e.g. "Phoenix, AZ, USA"
  lat double precision,
  lng double precision,
  geocoded boolean not null default false,
  event_date date,
  shape text,                                      -- e.g. 'triangle', 'sphere', 'light'
  duration_text text,                              -- raw duration string from source
  witness_count integer,
  has_media boolean not null default false,
  classification text not null default 'REPORTED' check (classification in ('REPORTED','CONFIRMED','ALLEGED')),
  upvotes integer not null default 0,
  comment_count integer not null default 0,
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz default now(),
  scraped_at timestamptz default now(),
  unique (source, source_id)
);

create index if not exists uap_sightings_event_date_idx on uap_sightings (event_date desc);
create index if not exists uap_sightings_location_idx on uap_sightings (lat, lng) where lat is not null;
create index if not exists uap_sightings_status_idx on uap_sightings (status);

create table if not exists uap_sighting_comments (
  id uuid default gen_random_uuid() primary key,
  sighting_id uuid references uap_sightings(id) on delete cascade not null,
  author_name text not null default 'Anonymous',
  author_fingerprint text not null,
  content text not null,
  likes integer not null default 0,
  dislikes integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists uap_sighting_comments_sighting_idx on uap_sighting_comments (sighting_id);

-- RLS
alter table uap_sightings enable row level security;
alter table uap_sighting_comments enable row level security;

drop policy if exists "Anyone can read uap sightings" on uap_sightings;
drop policy if exists "Service role can insert uap sightings" on uap_sightings;
drop policy if exists "Anyone can read uap comments" on uap_sighting_comments;
drop policy if exists "Anyone can create uap comments" on uap_sighting_comments;

create policy "Anyone can read uap sightings" on uap_sightings for select using (status = 'active');
create policy "Service role can insert uap sightings" on uap_sightings for insert with check (true);
create policy "Service role can update uap sightings" on uap_sightings for update with check (true);
create policy "Anyone can read uap comments" on uap_sighting_comments for select using (true);
create policy "Anyone can create uap comments" on uap_sighting_comments for insert with check (true);
create policy "Service role can update uap comments" on uap_sighting_comments for update with check (true);

-- Trigger: keep comment_count in sync
create or replace function update_sighting_comment_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update uap_sightings set comment_count = comment_count + 1 where id = NEW.sighting_id;
  elsif TG_OP = 'DELETE' then
    update uap_sightings set comment_count = greatest(0, comment_count - 1) where id = OLD.sighting_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists uap_sighting_comment_count on uap_sighting_comments;
create trigger uap_sighting_comment_count
  after insert or delete on uap_sighting_comments
  for each row execute procedure update_sighting_comment_count();
