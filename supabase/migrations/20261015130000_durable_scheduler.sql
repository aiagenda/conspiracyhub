-- Persist due work across delayed/missed cron ticks. Deploy before the new scheduler.
alter table public.scraper_jobs
  add column if not exists next_run_at timestamptz,
  add column if not exists retry_at timestamptz,
  add column if not exists failure_count integer not null default 0,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists active_run_id uuid;
alter table public.scraper_runs
  add column if not exists scheduled_for timestamptz,
  add column if not exists attempt integer not null default 1,
  add column if not exists idempotency_key text,
  add column if not exists schedule_snapshot text;
create unique index if not exists scraper_runs_idempotency_key_idx
  on public.scraper_runs(idempotency_key) where idempotency_key is not null;
create index if not exists scraper_jobs_due_idx on public.scraper_jobs(next_run_at) where enabled;

-- Claim and run insertion are one transaction under a row lock. Only service_role may invoke.
create or replace function public.claim_scraper_job(
  p_job_id uuid, p_trigger text, p_scheduled_for timestamptz,
  p_next_run_at timestamptz, p_expected_cron text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  job public.scraper_jobs%rowtype;
  run public.scraper_runs%rowtype;
  due_at timestamptz;
  run_key text;
  current_time_utc timestamptz := clock_timestamp();
begin
  if p_trigger not in ('cron', 'manual') then raise exception 'invalid trigger'; end if;
  select * into job from public.scraper_jobs where id = p_job_id for update;
  if not found or job.schedule_cron <> p_expected_cron then return null; end if;
  if job.lease_expires_at > current_time_utc then return null; end if;
  if p_trigger = 'cron' and not job.enabled then return null; end if;

  if job.active_run_id is not null then
    update public.scraper_runs set status = 'failed', finished_at = current_time_utc,
      error_text = 'Worker lease expired; retrying with a bounded attempt count'
      where id = job.active_run_id and status = 'running';
    job.failure_count := job.failure_count + 1;
    if job.failure_count >= 3 then
      update public.scraper_jobs set active_run_id = null, lease_expires_at = null,
        failure_count = 0, retry_at = null, next_run_at = p_next_run_at where id = job.id;
      return null;
    end if;
  end if;

  due_at := coalesce(job.next_run_at, p_scheduled_for);
  if p_trigger = 'cron' and coalesce(job.retry_at, due_at) > current_time_utc then return null; end if;
  if p_trigger = 'manual' then due_at := current_time_utc; end if;
  run_key := job.id::text || ':' || p_trigger || ':' || due_at::text || ':' || (job.failure_count + 1)::text;
  insert into public.scraper_runs(job_id, trigger, status, scheduled_for, attempt, idempotency_key, schedule_snapshot)
    values(job.id, p_trigger, 'running', due_at, job.failure_count + 1, run_key, job.schedule_cron)
    on conflict (idempotency_key) where idempotency_key is not null do nothing returning * into run;
  if run.id is null then return null; end if;
  update public.scraper_jobs set active_run_id = run.id,
    lease_expires_at = current_time_utc + interval '10 minutes',
    failure_count = job.failure_count,
    next_run_at = case when p_trigger = 'cron' then due_at else next_run_at end
    where id = job.id;
  return jsonb_build_object('id', run.id, 'started_at', run.started_at,
    'scheduled_for', run.scheduled_for, 'attempt', run.attempt);
end;
$$;

create or replace function public.finish_scraper_job(
  p_job_id uuid, p_run_id uuid, p_success boolean, p_next_run_at timestamptz,
  p_http_status integer, p_result jsonb, p_error text
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  job public.scraper_jobs%rowtype;
  run public.scraper_runs%rowtype;
  failures integer;
  current_time_utc timestamptz := clock_timestamp();
begin
  select * into job from public.scraper_jobs where id = p_job_id for update;
  if not found or job.active_run_id is distinct from p_run_id then return false; end if;
  select * into run from public.scraper_runs where id = p_run_id;
  update public.scraper_runs set status = case when p_success then 'success' else 'failed' end,
    finished_at = current_time_utc,
    duration_ms = least(2147483647, greatest(0, extract(epoch from (current_time_utc - started_at)) * 1000))::integer,
    http_status = p_http_status, result = p_result, error_text = p_error
    where id = p_run_id;
  -- An operator may change the schedule while a worker is running. Its completion
  -- must not restore the old due time or backoff onto that new schedule.
  if job.schedule_cron is distinct from run.schedule_snapshot then
    update public.scraper_jobs set active_run_id = null, lease_expires_at = null,
      failure_count = 0, retry_at = null, next_run_at = null where id = job.id;
    return true;
  end if;
  failures := case when p_success then 0 else job.failure_count + 1 end;
  update public.scraper_jobs set active_run_id = null, lease_expires_at = null,
    failure_count = case when failures >= 3 then 0 else failures end,
    retry_at = case when not p_success and failures < 3 and run.trigger = 'cron'
      then current_time_utc + interval '5 minutes' * power(3, failures - 1) else null end,
    next_run_at = case
      when run.trigger = 'manual' then next_run_at
      when p_success or failures >= 3 then p_next_run_at
      else next_run_at end
    where id = job.id;
  return true;
end;
$$;

revoke all on function public.claim_scraper_job(uuid,text,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke all on function public.finish_scraper_job(uuid,uuid,boolean,timestamptz,integer,jsonb,text) from public, anon, authenticated;
grant execute on function public.claim_scraper_job(uuid,text,timestamptz,timestamptz,text) to service_role;
grant execute on function public.finish_scraper_job(uuid,uuid,boolean,timestamptz,integer,jsonb,text) to service_role;

-- A change to timing should not inherit an occurrence from the old schedule.
create or replace function public.reset_scraper_schedule() returns trigger language plpgsql set search_path = public as $$
begin
  if new.schedule_cron is distinct from old.schedule_cron then
    new.next_run_at := null;
    new.retry_at := null;
    new.failure_count := 0;
  end if;
  return new;
end;
$$;
drop trigger if exists reset_scraper_schedule on public.scraper_jobs;
create trigger reset_scraper_schedule before update of schedule_cron on public.scraper_jobs
  for each row execute function public.reset_scraper_schedule();

-- Defaults are inserted once. Subsequent console reads do not overwrite operator choices.
insert into public.scraper_jobs(job_key,name,target,schedule_cron,enabled,config) values
  ('weekly_briefing','Weekly intelligence briefing email','weekly_briefing','0 9 * * 0',false,'{}'),
  ('seismic_refresh','Seismic monitor refresh','seismic_scraper','0 * * * *',false,'{}'),
  ('search_console_sync','Search Console sync','search_console','0 7 * * 0',true,'{}'),
  ('article_writer_gsc','Search Console SEO Article','article_writer','0 8 * * 0',true,'{"mode":"search_console"}')
on conflict (job_key) do nothing;
