-- GROUP POLLS
-- A poll is attached to a group message (same id) so it appears in the timeline and chat list preview.
create table if not exists public.group_polls (
  id uuid primary key references public.group_messages(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 200),
  options text[] not null check (array_length(options, 1) between 2 and 6),
  multi boolean not null default false,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.group_polls enable row level security;

create table if not exists public.group_poll_votes (
  poll_id uuid not null references public.group_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_idx int not null check (option_idx between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id, option_idx)
);
alter table public.group_poll_votes enable row level security;

drop policy if exists "members read polls" on public.group_polls;
create policy "members read polls" on public.group_polls for select to authenticated using (public.is_group_member(group_id));
drop policy if exists "members read poll votes" on public.group_poll_votes;
create policy "members read poll votes" on public.group_poll_votes for select to authenticated
  using (exists (select 1 from public.group_polls p where p.id = poll_id and public.is_group_member(p.group_id)));

-- All writes go through these functions so options, membership and closed state are checked in one place.
create or replace function public.create_group_poll(p_group uuid, p_question text, p_options text[], p_multi boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid; opts text[];
begin
  if not public.is_group_member(p_group) then raise exception 'Not a member of this group'; end if;
  select array_agg(left(trim(o), 80)) into opts from unnest(p_options) o where trim(o) <> '';
  if coalesce(array_length(opts, 1), 0) not between 2 and 6 then raise exception 'A poll needs 2 to 6 options'; end if;
  p_question := left(trim(p_question), 200);
  if p_question = '' then raise exception 'A poll needs a question'; end if;
  insert into public.group_messages (group_id, sender_id, body) values (p_group, auth.uid(), '📊 Poll: ' || p_question) returning id into mid;
  insert into public.group_polls (id, group_id, created_by, question, options, multi) values (mid, p_group, auth.uid(), p_question, opts, coalesce(p_multi, false));
  return mid;
end $$;

create or replace function public.vote_group_poll(p_poll uuid, p_options int[])
returns void language plpgsql security definer set search_path = public as $$
declare p public.group_polls;
begin
  select * into p from public.group_polls where id = p_poll;
  if not found or not public.is_group_member(p.group_id) then raise exception 'Poll not found'; end if;
  if p.closed then raise exception 'This poll is closed'; end if;
  if not p.multi and coalesce(array_length(p_options, 1), 0) > 1 then raise exception 'Pick one option'; end if;
  delete from public.group_poll_votes where poll_id = p_poll and user_id = auth.uid();
  insert into public.group_poll_votes (poll_id, user_id, option_idx)
    select p_poll, auth.uid(), i from unnest(coalesce(p_options, '{}')) i
    where i >= 0 and i < array_length(p.options, 1)
    on conflict do nothing;
end $$;

create or replace function public.close_group_poll(p_poll uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.group_polls;
begin
  select * into p from public.group_polls where id = p_poll;
  if not found or not (p.created_by = auth.uid() or public.is_group_admin(p.group_id)) then raise exception 'Only the poll creator or a group admin can close it'; end if;
  update public.group_polls set closed = true where id = p_poll;
end $$;

revoke all on function public.create_group_poll(uuid, text, text[], boolean) from public, anon;
grant execute on function public.create_group_poll(uuid, text, text[], boolean) to authenticated;
revoke all on function public.vote_group_poll(uuid, int[]) from public, anon;
grant execute on function public.vote_group_poll(uuid, int[]) to authenticated;
revoke all on function public.close_group_poll(uuid) from public, anon;
grant execute on function public.close_group_poll(uuid) to authenticated;

create index if not exists idx_group_polls_group on public.group_polls(group_id);

do $$ begin
  alter publication supabase_realtime add table public.group_polls;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.group_poll_votes;
exception when duplicate_object then null; end $$;
