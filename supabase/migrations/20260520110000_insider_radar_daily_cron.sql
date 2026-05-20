-- Hobby Vercel: one cron per day — insider refresh runs with scheduler tick at 09:00 UTC only.
update public.scraper_jobs
set schedule_cron = '0 9 * * *'
where job_key = 'insider_radar_refresh';
