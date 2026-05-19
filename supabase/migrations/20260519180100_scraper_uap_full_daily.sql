-- Daily UTC 09:00 — UAP full refresh (replaces legacy uap_nuforc cron)
update public.scraper_jobs
set schedule_cron = '0 9 * * *', enabled = true
where job_key = 'uap_full_refresh';

update public.scraper_jobs
set enabled = false
where job_key = 'uap_nuforc';
