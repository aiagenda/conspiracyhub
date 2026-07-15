-- Local development seed data for `supabase start` / `supabase db reset`.
-- This file is NOT used in production (hosted Supabase). It only makes a local
-- stack usable for development: it restores the standard Supabase role grants
-- that hosted projects apply automatically, then inserts a few demo feed rows.

-- ── Role grants ──────────────────────────────────────────────────────────────
-- The SQL migrations create tables but never GRANT privileges to the PostgREST
-- roles. Hosted Supabase grants these automatically; the local CLI does not, so
-- without this block the anon/service_role API returns "permission denied".
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ── Demo feed rows ───────────────────────────────────────────────────────────
insert into news_items (guardian_id, title, summary, url, image, published_at, section, score, angle) values
('demo-1','Pentagon quietly expands classified UAP task force','Leaked budget documents reveal a 40% funding increase for the Pentagon''s UAP analysis office, with new contracts routed through undisclosed vendors.','https://example.com/uap-taskforce',null, now() - interval '2 hours','US news',87,'Follow the money: undisclosed vendors suggest deliberate opacity around UAP research spending.'),
('demo-2','FOIA release exposes decades of weather-modification experiments','Newly declassified files detail government cloud-seeding programs that ran far longer than previously acknowledged.','https://example.com/weather-mod',null, now() - interval '6 hours','Environment',79,'The paper trail contradicts prior official denials about program duration.'),
('demo-3','Insider trading spike precedes major defense contractor merger','Unusual options activity flagged by analysts days before the announcement points to possible information leakage.','https://example.com/insider-defense',null, now() - interval '1 day','Business',72,'Timing of trades aligns suspiciously with non-public merger talks.')
on conflict (guardian_id) do nothing;
