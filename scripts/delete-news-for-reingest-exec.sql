-- Executable only (no preview): run after reviewing delete-news-for-reingest.sql
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

DELETE FROM public.news_items
WHERE title ILIKE '%Megathread%Pentagon%UFO%'
   OR title ILIKE '%Pentagon%release%UFO%'
   OR url ILIKE '%reddit.com/r/ufos%';
