-- Add reply support, like/dislike counters, and GIF URL to thread_posts
alter table thread_posts
  add column if not exists parent_post_id uuid references thread_posts(id) on delete cascade,
  add column if not exists likes integer not null default 0,
  add column if not exists dislikes integer not null default 0;

create index if not exists thread_posts_parent_idx
  on thread_posts (parent_post_id)
  where parent_post_id is not null;

-- Atomic increment helper used by the /api/threads react_post action
create or replace function increment_post_reaction(post_id_param uuid, col_name text)
returns table(likes integer, dislikes integer)
language plpgsql
as $$
begin
  if col_name = 'likes' then
    update thread_posts set likes = likes + 1 where id = post_id_param;
  elsif col_name = 'dislikes' then
    update thread_posts set dislikes = dislikes + 1 where id = post_id_param;
  end if;
  return query select p.likes, p.dislikes from thread_posts p where p.id = post_id_param;
end;
$$;
