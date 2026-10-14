-- 1) backfill profiles for every auth user that lacks one (fixes "can't find registered user")
insert into public.profiles (id, name)
select u.id, coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 2) make the lookup case/space-insensitive and never miss a profile
create or replace function public.find_profile_by_email(p_email text)
returns table (id uuid, name text, avatar text, about text)
language sql security definer set search_path = public, auth stable as $$
  select p.id, p.name, p.avatar, p.about
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(trim(u.email)) = lower(trim(p_email)) and u.id <> auth.uid()
  limit 1
$$;
revoke all on function public.find_profile_by_email(text) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;

-- 3) contacts: saved contacts, favorites, blocks, archive/pin/delete per chat
create table if not exists public.contacts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references auth.users(id) on delete cascade,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);
alter table public.contacts enable row level security;
drop policy if exists "own contacts" on public.contacts;
create policy "own contacts" on public.contacts for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists "own blocks" on public.blocks;
create policy "own blocks" on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create table if not exists public.chat_prefs (
  owner_id uuid not null references auth.users(id) on delete cascade,
  peer_id uuid not null references auth.users(id) on delete cascade,
  archived boolean not null default false,
  pinned boolean not null default false,
  deleted_before timestamptz,
  primary key (owner_id, peer_id)
);
alter table public.chat_prefs enable row level security;
drop policy if exists "own chat prefs" on public.chat_prefs;
create policy "own chat prefs" on public.chat_prefs for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 4) a user can't message someone who blocked them or whom they blocked
create or replace function public.is_blocked_pair(a uuid, b uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

drop policy if exists "send as self" on public.messages;
create policy "send as self" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and recipient_id <> auth.uid() and not public.is_blocked_pair(auth.uid(), recipient_id));
