-- Daily news-jacking kept publishing a new URL for stories that already had a page.
-- Named evergreen and Search Console jobs stay on; they skip a topic that already exists.
update public.scraper_jobs
set enabled = false
where job_key = 'article_writer_daily';
