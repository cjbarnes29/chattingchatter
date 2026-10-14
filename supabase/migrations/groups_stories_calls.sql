
-- GROUPS
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#E0573B',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.groups enable row level security;

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.group_messages enable row level security;

create or replace function public.is_group_member(p_group uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid());
$$;

create or replace function public.is_group_admin(p_group uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid() and role = 'admin');
$$;

drop policy if exists "members read groups" on public.groups;
create policy "members read groups" on public.groups for select to authenticated using (public.is_group_member(id));
drop policy if exists "create groups" on public.groups;
create policy "create groups" on public.groups for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "admins update groups" on public.groups;
create policy "admins update groups" on public.groups for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));
drop policy if exists "admins delete groups" on public.groups;
create policy "admins delete groups" on public.groups for delete to authenticated using (public.is_group_admin(id));

drop policy if exists "members read members" on public.group_members;
create policy "members read members" on public.group_members for select to authenticated using (public.is_group_member(group_id));
drop policy if exists "admins add members" on public.group_members;
create policy "admins add members" on public.group_members for insert to authenticated with check (public.is_group_admin(group_id) or (user_id = auth.uid() and role = 'admin' and exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())));
drop policy if exists "admins remove or self leave" on public.group_members;
create policy "admins remove or self leave" on public.group_members for delete to authenticated using (public.is_group_admin(group_id) or user_id = auth.uid());
drop policy if exists "admins change roles" on public.group_members;
create policy "admins change roles" on public.group_members for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

drop policy if exists "members read group msgs" on public.group_messages;
create policy "members read group msgs" on public.group_messages for select to authenticated using (public.is_group_member(group_id));
drop policy if exists "members send group msgs" on public.group_messages;
create policy "members send group msgs" on public.group_messages for insert to authenticated with check (sender_id = auth.uid() and public.is_group_member(group_id));
drop policy if exists "senders delete group msgs" on public.group_messages;
create policy "senders delete group msgs" on public.group_messages for delete to authenticated using (sender_id = auth.uid());

-- STORIES (auto-expire by visible_until)
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  visible_days int not null default 1 check (visible_days between 1 and 7),
  created_at timestamptz not null default now(),
  visible_until timestamptz not null default (now() + interval '1 day')
);
alter table public.stories enable row level security;

create table if not exists public.story_reactions (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.story_reactions enable row level security;

-- visible to the author and to anyone who has an open chat with the author
create or replace function public.can_see_story(p_author uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select p_author = auth.uid() or exists (
    select 1 from public.messages m
    where (m.sender_id = auth.uid() and m.recipient_id = p_author)
       or (m.sender_id = p_author and m.recipient_id = auth.uid())
  ) or exists (
    select 1 from public.group_members a join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = p_author
  );
$$;

drop policy if exists "read live stories" on public.stories;
create policy "read live stories" on public.stories for select to authenticated using (visible_until > now() and public.can_see_story(author_id));
drop policy if exists "author posts stories" on public.stories;
create policy "author posts stories" on public.stories for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "author deletes stories" on public.stories;
create policy "author deletes stories" on public.stories for delete to authenticated using (author_id = auth.uid());

drop policy if exists "read reactions" on public.story_reactions;
create policy "read reactions" on public.story_reactions for select to authenticated using (exists (select 1 from public.stories s where s.id = story_id and s.visible_until > now() and public.can_see_story(s.author_id)));
drop policy if exists "react to stories" on public.story_reactions;
create policy "react to stories" on public.story_reactions for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.stories s where s.id = story_id and s.visible_until > now() and public.can_see_story(s.author_id)));
drop policy if exists "change own reaction" on public.story_reactions;
create policy "change own reaction" on public.story_reactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "remove own reaction" on public.story_reactions;
create policy "remove own reaction" on public.story_reactions for delete to authenticated using (user_id = auth.uid());

-- CALL SIGNALING (WebRTC offers/answers/ICE carried through the database)
create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('invite','answer','ice','hangup','decline')),
  media text not null default 'voice' check (media in ('voice','video')),
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table public.call_signals enable row level security;

drop policy if exists "read own signals" on public.call_signals;
create policy "read own signals" on public.call_signals for select to authenticated using (recipient_id = auth.uid() or sender_id = auth.uid());
drop policy if exists "send signals" on public.call_signals;
create policy "send signals" on public.call_signals for insert to authenticated with check (sender_id = auth.uid());

create index if not exists idx_group_members_user on public.group_members(user_id);
create index if not exists idx_group_messages_group on public.group_messages(group_id, created_at);
create index if not exists idx_stories_author on public.stories(author_id, visible_until);
create index if not exists idx_call_signals_recipient on public.call_signals(recipient_id, created_at);

-- Realtime for live updates
do $$ begin
  alter publication supabase_realtime add table public.group_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.group_members;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.stories;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.story_reactions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.call_signals;
exception when duplicate_object then null; end $$;

-- Helper to create a group with the creator as admin in one step (avoids RLS chicken-and-egg)
create or replace function public.create_group(p_name text, p_color text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid; m uuid;
begin
  insert into public.groups (name, color, created_by) values (p_name, coalesce(p_color,'#E0573B'), auth.uid()) returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, auth.uid(), 'admin');
  foreach m in array coalesce(p_members, '{}') loop
    if m <> auth.uid() then
      insert into public.group_members (group_id, user_id, role) values (gid, m, 'member') on conflict do nothing;
    end if;
  end loop;
  return gid;
end $$;

-- Look up several users by email at once (for group creation)
create or replace function public.find_profiles_by_emails(p_emails text[])
returns table(id uuid, name text, avatar text, about text)
language sql security definer stable set search_path = public as $$
  select p.id, p.name, p.avatar, p.about from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = any (select lower(e) from unnest(p_emails) e);
$$;
