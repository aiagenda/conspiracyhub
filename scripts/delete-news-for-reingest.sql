-- Re-ingest a feed item: delete from DB so the next scraper run can upsert it again
-- (scraper uses ON CONFLICT (guardian_id) on news_items).
--
-- CLI (linked project):  npx supabase db query --linked -f scripts/delete-news-for-reingest-exec.sql
--
-- Run in Supabase → SQL Editor (service role not required for DELETE if your RLS
-- allows it; often you need the dashboard SQL editor which bypasses RLS, or
-- use the service key from a script).
--
-- 1) Preview what will be removed:
SELECT id, guardian_id, title, url, published_at, score
FROM public.news_items
WHERE title ILIKE '%Megathread%Pentagon%UFO%'
   OR title ILIKE '%Pentagon%release%UFO%'
   OR url ILIKE '%reddit.com/r/ufos%';

-- 2) Remove bets that reference Oracle analyses for those rows (FK has no ON DELETE CASCADE).
DELETE FROM public.bets
WHERE analysis_id IN (
  SELECT o.id
  FROM public.oracle_analyses o
  WHERE o.news_id IN (
    SELECT n.id
    FROM public.news_items n
    WHERE n.title ILIKE '%Megathread%Pentagon%UFO%'
       OR n.title ILIKE '%Pentagon%release%UFO%'
       OR n.url ILIKE '%reddit.com/r/ufos%'
  )
);

-- 3) Delete the news row(s). Cascades to oracle_analyses, votes (article_id), etc.
DELETE FROM public.news_items
WHERE title ILIKE '%Megathread%Pentagon%UFO%'
   OR title ILIKE '%Pentagon%release%UFO%'
   OR url ILIKE '%reddit.com/r/ufos%';

-- If you know the exact UUID from step 1, prefer this (safest):
-- DELETE FROM public.bets WHERE analysis_id IN (SELECT id FROM public.oracle_analyses WHERE news_id = 'YOUR-UUID-HERE');
-- DELETE FROM public.news_items WHERE id = 'YOUR-UUID-HERE';
