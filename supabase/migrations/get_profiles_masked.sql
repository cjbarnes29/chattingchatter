-- Returns profiles for the given people. A private profile's nickname, age, status and about are only
-- returned to its owner; everyone else gets name, photo and presence only.
create or replace function public.get_profiles(p_ids uuid[])
returns table (id uuid, name text, avatar text, about text, nickname text, age int, status text, presence_mode text, last_seen timestamptz, profile_visibility text, public_id text)
language sql security definer set search_path = public stable as $$
  select p.id, p.name, p.avatar,
    case when p.id = auth.uid() or p.profile_visibility = 'public' then p.about else null end,
    case when p.id = auth.uid() or p.profile_visibility = 'public' then p.nickname else null end,
    case when p.id = auth.uid() or p.profile_visibility = 'public' then p.age else null end,
    case when p.id = auth.uid() or p.profile_visibility = 'public' then p.status else null end,
    p.presence_mode, p.last_seen, p.profile_visibility,
    case when p.id = auth.uid() then p.public_id else null end
  from public.profiles p
  where p.id = any(p_ids)
$$;
revoke all on function public.get_profiles(uuid[]) from public, anon;
grant execute on function public.get_profiles(uuid[]) to authenticated;

-- STEP 2, run only after the app version that calls get_profiles() is live for everyone:
-- revoke select (about, nickname, age, status) on public.profiles from authenticated;
