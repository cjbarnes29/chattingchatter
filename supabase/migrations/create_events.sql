create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  peer_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  note text not null default '',
  starts_at timestamptz not null,
  remind_minutes int not null default 15 check (remind_minutes between 0 and 10080),
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists events_creator_idx on public.events (creator_id, starts_at);
create index if not exists events_peer_idx on public.events (peer_id, starts_at);
alter table public.events enable row level security;
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated using (auth.uid() = creator_id or auth.uid() = peer_id);
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated with check (auth.uid() = creator_id);
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated using (auth.uid() = creator_id);
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; when undefined_object then null;
end $$;