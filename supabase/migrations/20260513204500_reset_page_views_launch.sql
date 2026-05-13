-- Clear pre-launch page view aggregate (admin / internal analytics via /api/track).
truncate table public.page_views restart identity;
