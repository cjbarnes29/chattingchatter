-- Security hardening. Verified against the live schema (advisors + pg_proc/pg_policies/grants) before writing.
-- PART A is safe for every app version. PART B (profile column lock) needs the app build that reads profiles
-- only through get_profiles() (commit 3e28574 and later, incl. the public_id change in this release).

-- ===== PART A =====

-- A1. find_profile_by_* returned `about` even for private profiles. Mask it like get_profiles() does.
create or replace function public.find_profile_by_email(p_email text)
returns table(id uuid, name text, avatar text, about text)
language sql security definer stable set search_path = public, auth as $$
  select p.id, p.name, p.avatar, case when p.profile_visibility = 'public' then p.about else null end
  from auth.users u join public.profiles p on p.id = u.id
  where lower(trim(u.email)) = lower(trim(p_email)) and u.id <> auth.uid() and auth.uid() is not null
  limit 1
$$;
create or replace function public.find_profile_by_public_id(p_id text)
returns table(id uuid, name text, avatar text, about text)
language sql security definer stable set search_path = public as $$
  select p.id, p.name, p.avatar, case when p.profile_visibility = 'public' then p.about else null end
  from public.profiles p
  where p.public_id = upper(regexp_replace(coalesce(p_id, ''), '[^0-9A-Za-z]', '', 'g'))
    and p.id <> auth.uid() and auth.uid() is not null
    and not public.is_blocked_pair(auth.uid(), p.id)
  limit 1
$$;
create or replace function public.find_profiles_by_emails(p_emails text[])
returns table(id uuid, name text, avatar text, about text)
language sql security definer stable set search_path = public as $$
  select p.id, p.name, p.avatar, case when p.profile_visibility = 'public' then p.about else null end
  from public.profiles p join auth.users u on u.id = p.id
  where lower(trim(u.email)) = any (select lower(trim(e)) from unnest(p_emails[1:200]) e)
    and u.id <> auth.uid() and auth.uid() is not null
$$;

-- A2. is_blocked_pair(a, b) let any signed-in user ask whether two OTHER people had blocked each other.
--     Every caller passes auth.uid() as `a`, so only that case is answered.
create or replace function public.is_blocked_pair(a uuid, b uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select a = auth.uid() and exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

-- A3. search_path on the three flagged non-definer trigger/helper functions
alter function public.story_reply_ok() set search_path = public;
alter function public.keep_expiry() set search_path = public;
alter function public.attachment_uuid(text) set search_path = public;

-- A4. Execution grants: nobody signed-out can run anything; trigger functions are not callable over the API at all.
-- (signed-in access was partly inherited from PUBLIC, so grant it explicitly before revoking PUBLIC)
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.handle_new_user(), public.keep_expiry(), public.story_reply_ok(),
  public.gen_public_id(), public.keep_public_id(), public.ghost_sessions_guard(), public.purge_expired()
  from authenticated;
-- (triggers fire as their table's operation, not through EXECUTE; RLS helpers stay executable by signed-in users because policies call them)
alter default privileges in schema public revoke execute on functions from public, anon;

-- A5. user_security holds a bcrypt hash of the recovery answer. Only the SECURITY DEFINER functions
--     get_security_question / check_security_answer / set_security_question (own row via auth.uid()) may touch it.
revoke all on table public.user_security from anon, authenticated;
drop policy if exists "no direct access" on public.user_security;
create policy "no direct access" on public.user_security as restrictive for all to anon, authenticated using (false) with check (false);

-- A6. Stray empty table `chattingchatter` is not used by the app: keep it unreachable through the API.
revoke all on table public.chattingchatter from anon, authenticated;

-- ===== PART B: lock private profile columns =====
revoke all on table public.profiles from anon;
revoke select, delete, truncate, references, trigger on table public.profiles from authenticated;
-- sensitive columns (about, nickname, age, status, public_id) are no longer readable through the table API;
-- they come out of get_profiles(), which masks them for private profiles.
grant select (id, name, avatar, created_at, presence_mode, last_seen, profile_visibility) on public.profiles to authenticated;
