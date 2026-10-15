-- 1) Recipients could rewrite body/sender/time of messages they received.
--    Only read_at may be updated.
revoke update on public.messages from anon, authenticated;
grant update (read_at) on public.messages to authenticated;

-- 2) Story edit had no UPDATE policy (edits silently failed). Author may edit body only.
drop policy if exists "author edits stories" on public.stories;
create policy "author edits stories" on public.stories for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
revoke update on public.stories from anon, authenticated;
grant update (body) on public.stories to authenticated;

-- 3) Email-enumeration: these SECURITY DEFINER functions were callable by anyone with the anon key.
revoke all on function public.find_profiles_by_emails(text[]) from public, anon;
grant execute on function public.find_profiles_by_emails(text[]) to authenticated;
revoke all on function public.create_group(text, text, uuid[]) from public, anon;
grant execute on function public.create_group(text, text, uuid[]) to authenticated;
create or replace function public.find_profiles_by_emails(p_emails text[])
returns table(id uuid, name text, avatar text, about text)
language sql security definer stable set search_path = public as $$
  select p.id, p.name, p.avatar, p.about from public.profiles p
  join auth.users u on u.id = p.id
  where lower(trim(u.email)) = any (select lower(trim(e)) from unnest(p_emails[1:200]) e)
    and u.id <> auth.uid();
$$;

-- 4) Missing size limits
alter table public.group_messages drop constraint if exists group_messages_body_len;
alter table public.group_messages add constraint group_messages_body_len check (char_length(body) between 1 and 4000) not valid;
alter table public.stories drop constraint if exists stories_body_len;
alter table public.stories add constraint stories_body_len check (char_length(body) between 1 and 2000) not valid;
alter table public.story_reactions drop constraint if exists story_reactions_emoji_len;
alter table public.story_reactions add constraint story_reactions_emoji_len check (char_length(emoji) between 1 and 16) not valid;
alter table public.groups drop constraint if exists groups_name_len;
alter table public.groups add constraint groups_name_len check (char_length(name) between 1 and 60) not valid;

-- 5) Blocked users / self could still send call invites
drop policy if exists "send signals" on public.call_signals;
create policy "send signals" on public.call_signals for insert to authenticated
  with check (sender_id = auth.uid() and recipient_id <> auth.uid() and not public.is_blocked_pair(auth.uid(), recipient_id));
