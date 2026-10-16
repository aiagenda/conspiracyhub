-- Run only against a disposable database seeded with the scheduler/article tables and
-- the two 20261015 migrations. All test rows are rolled back.
\set ON_ERROR_STOP on
begin;
do $$
declare
  jid uuid; rid uuid; claim jsonb; due timestamptz := now() - interval '1 hour';
  next_at timestamptz := now() + interval '1 day';
  row_state public.scraper_jobs%rowtype;
  aid uuid; article public.generated_articles%rowtype;
begin
  insert into public.scraper_jobs(job_key,name,target,schedule_cron,next_run_at)
    values ('upgrade_test','test','article_writer','0 7 * * *',due) returning id into jid;
  claim := public.claim_scraper_job(jid,'cron',due,next_at,'0 7 * * *');
  if claim is null or (claim->>'attempt')::int <> 1 then raise exception 'Initial claim failed'; end if;
  rid := (claim->>'id')::uuid;
  if public.claim_scraper_job(jid,'cron',due,next_at,'0 7 * * *') is not null then raise exception 'Duplicate worker acquired active lease'; end if;
  if public.finish_scraper_job(jid,gen_random_uuid(),true,next_at,200,'{}',null) then raise exception 'Wrong worker could finish another lease'; end if;
  if not public.finish_scraper_job(jid,rid,false,next_at,500,'{}','test failure') then raise exception 'Finish failed'; end if;
  select * into row_state from public.scraper_jobs where id=jid;
  if row_state.retry_at is null or row_state.failure_count <> 1 or row_state.next_run_at <> due then raise exception 'Failure lost scheduled occurrence or retry'; end if;
  if public.claim_scraper_job(jid,'cron',due,next_at,'0 7 * * *') is not null then raise exception 'Retry ran before backoff'; end if;
  update public.scraper_jobs set retry_at=now()-interval '1 minute' where id=jid;
  claim := public.claim_scraper_job(jid,'cron',due,next_at,'0 7 * * *');
  if (claim->>'attempt')::int <> 2 then raise exception 'Retry attempt not incremented'; end if;
  perform public.finish_scraper_job(jid,(claim->>'id')::uuid,false,next_at,500,'{}','second failure');
  update public.scraper_jobs set retry_at=now()-interval '1 minute' where id=jid;
  claim := public.claim_scraper_job(jid,'cron',due,next_at,'0 7 * * *');
  if (claim->>'attempt')::int <> 3 then raise exception 'Third attempt missing'; end if;
  perform public.finish_scraper_job(jid,(claim->>'id')::uuid,false,next_at,500,'{}','third failure');
  select * into row_state from public.scraper_jobs where id=jid;
  if row_state.retry_at is not null or row_state.next_run_at <> next_at then raise exception 'Retry bound not respected'; end if;
  if public.claim_scraper_job(jid,'cron',due,next_at,'0 7 * * *') is not null then raise exception 'Completed occurrence ran again'; end if;
  update public.scraper_jobs set next_run_at=now()-interval '2 hours' where id=jid;
  claim := public.claim_scraper_job(jid,'cron',now()-interval '2 hours',next_at,'0 7 * * *');
  rid := (claim->>'id')::uuid;
  update public.scraper_jobs set lease_expires_at=now()-interval '1 minute' where id=jid;
  claim := public.claim_scraper_job(jid,'cron',now()-interval '2 hours',next_at,'0 7 * * *');
  if claim is null or (claim->>'attempt')::int <> 2 then raise exception 'Expired lease not recovered'; end if;
  if public.finish_scraper_job(jid,rid,true,next_at,200,'{}',null) then raise exception 'Expired worker overwrote replacement'; end if;
  perform public.finish_scraper_job(jid,(claim->>'id')::uuid,true,next_at,200,'{}',null);
  update public.scraper_jobs set schedule_cron='0 8 * * *' where id=jid;
  select * into row_state from public.scraper_jobs where id=jid;
  if row_state.next_run_at is not null or row_state.failure_count <> 0 then raise exception 'Changed schedule retained old due time'; end if;
  if public.claim_scraper_job(jid,'cron',due,next_at,'0 7 * * *') is not null then raise exception 'Stale schedule snapshot acquired lease'; end if;
  claim := public.claim_scraper_job(jid,'cron',due,next_at,'0 8 * * *');
  update public.scraper_jobs set schedule_cron='0 10 * * *' where id=jid;
  perform public.finish_scraper_job(jid,(claim->>'id')::uuid,true,next_at,200,'{}',null);
  select * into row_state from public.scraper_jobs where id=jid;
  if row_state.next_run_at is not null then raise exception 'Worker restored superseded schedule'; end if;
  if has_function_privilege('anon','public.claim_scraper_job(uuid,text,timestamptz,timestamptz,text)','execute') then raise exception 'Anonymous scheduler privilege'; end if;
  if has_function_privilege('authenticated','public.finish_scraper_job(uuid,uuid,boolean,timestamptz,integer,jsonb,text)','execute') then raise exception 'Authenticated scheduler privilege'; end if;

  insert into public.generated_articles(title,slug,content,status,editorial_checks,verified_at)
    values('A reviewed story','upgrade-test','Reviewed body','published','{"passed":true}',now()) returning id into aid;
  update public.generated_articles set sources='[{"url":"https://example.com/changed"}]' where id=aid;
  select * into article from public.generated_articles where id=aid;
  if article.status <> 'draft' or article.verified_at is not null or article.editorial_checks is not null then raise exception 'Changed evidence retained approval'; end if;
  insert into public.generated_articles(title,slug,content) values('Draft default','upgrade-default','Draft body');
  if (select status from public.generated_articles where slug='upgrade-default') <> 'draft' then raise exception 'New content default is public'; end if;
  raise notice 'Scheduler lease, duplicate claim, backoff, retry bound, stale worker, schedule reset, RPC permissions and review invalidation passed.';
end $$;
grant select,insert,update,delete on public.generated_articles to anon;
set local role anon;
do $$ begin
  if exists(select 1 from public.generated_articles where slug in ('upgrade-test','upgrade-default')) then raise exception 'Anonymous reader can see drafts'; end if;
  begin
    insert into public.generated_articles(title,slug,content) values('Unauthorized','unauthorized','No');
    raise exception 'Anonymous reader can insert articles';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
