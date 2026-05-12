-- Align with Vercel Hobby: one daily tick at 09:00 UTC (US-quiet window).
-- Both jobs must match the same minute/hour so /api/scheduler/tick runs them in one invocation.
update public.scraper_jobs
set schedule_cron = '0 9 * * *'
where job_key in ('news_main', 'uap_nuforc');
