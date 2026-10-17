-- Ghost Canvas sessions: an explicit invitation the other person must accept before anything is shared.
-- The live drawing channel (ghost:<session id>) is private: only the two people in an ACCEPTED session can join it.

create table if not exists public.ghost_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid not null references auth.users(id) on delete cascade,
  notify text not null default 'notification' check (notify in ('notification', 'call')),
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined', 'cancelled', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (host_id <> guest_id)
);
alter table public.ghost_sessions enable row level security;

create index if not exists idx_ghost_sessions_guest on public.ghost_sessions (guest_id, created_at desc);
create index if not exists idx_ghost_sessions_host on public.ghost_sessions (host_id, created_at desc);

drop policy if exists "ghost participants read" on public.ghost_sessions;
create policy "ghost participants read" on public.ghost_sessions for select to authenticated
  using (host_id = auth.uid() or guest_id = auth.uid());

-- only the host can invite, never someone who is blocked either way
drop policy if exists "ghost host invites" on public.ghost_sessions;
create policy "ghost host invites" on public.ghost_sessions for insert to authenticated
  with check (host_id = auth.uid() and status = 'invited' and not public.is_blocked_pair(auth.uid(), guest_id));

drop policy if exists "ghost participants update" on public.ghost_sessions;
create policy "ghost participants update" on public.ghost_sessions for update to authenticated
  using (host_id = auth.uid() or guest_id = auth.uid())
  with check (host_id = auth.uid() or guest_id = auth.uid());

-- who may move a session to which state
create or replace function public.ghost_sessions_guard() returns trigger
language plpgsql as $$
begin
  if new.host_id <> old.host_id or new.guest_id <> old.guest_id or new.notify <> old.notify then
    raise exception 'ghost session people cannot change';
  end if;
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'invited' and new.status in ('accepted', 'declined') and auth.uid() = old.guest_id then
    null;
  elsif old.status = 'invited' and new.status = 'cancelled' and auth.uid() = old.host_id then
    null;
  elsif old.status = 'accepted' and new.status = 'ended' then
    null;
  else
    raise exception 'invalid ghost session change';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists ghost_sessions_guard on public.ghost_sessions;
create trigger ghost_sessions_guard before update on public.ghost_sessions for each row execute function public.ghost_sessions_guard();

do $$ begin
  alter publication supabase_realtime add table public.ghost_sessions;
exception when duplicate_object then null; end $$;

-- Realtime Authorization for the private channel "ghost:<session id>"
drop policy if exists "ghost participants receive" on realtime.messages;
create policy "ghost participants receive" on realtime.messages for select to authenticated
  using (
    exists (
      select 1 from public.ghost_sessions g
      where 'ghost:' || g.id::text = (select realtime.topic())
        and g.status = 'accepted'
        and auth.uid() in (g.host_id, g.guest_id)
    )
  );
drop policy if exists "ghost participants send" on realtime.messages;
create policy "ghost participants send" on realtime.messages for insert to authenticated
  with check (
    exists (
      select 1 from public.ghost_sessions g
      where 'ghost:' || g.id::text = (select realtime.topic())
        and g.status = 'accepted'
        and auth.uid() in (g.host_id, g.guest_id)
    )
  );
