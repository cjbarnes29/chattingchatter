-- Message Control Center (server side) + Story Maker / stories panel. NOT APPLIED YET: run it in the Supabase SQL Editor.
-- Until then:
--   * disappearing messages are hidden by the apps but stay in the database,
--   * photo/GIF stories, custom story audiences and public story replies show
--     "needs the stories database update"; private text replies are sent as direct messages.

-- ---------- 1. Disappearing messages ----------
alter table public.messages add column if not exists expires_at timestamptz;
alter table public.group_messages add column if not exists expires_at timestamptz;
create index if not exists messages_expires_at on public.messages (expires_at) where expires_at is not null;
create index if not exists group_messages_expires_at on public.group_messages (expires_at) where expires_at is not null;

-- an expired message is never returned, whatever the other policies allow (restrictive = AND)
drop policy if exists "hide expired messages" on public.messages;
create policy "hide expired messages" on public.messages as restrictive for select to authenticated
  using (expires_at is null or expires_at > now());
drop policy if exists "hide expired group messages" on public.group_messages;
create policy "hide expired group messages" on public.group_messages as restrictive for select to authenticated
  using (expires_at is null or expires_at > now());

-- the sender can't push the expiry later or remove it after sending
create or replace function public.keep_expiry() returns trigger language plpgsql as $$
begin
  if old.expires_at is not null and (new.expires_at is null or new.expires_at > old.expires_at) then
    new.expires_at := old.expires_at;
  end if;
  return new;
end $$;
drop trigger if exists messages_keep_expiry on public.messages;
create trigger messages_keep_expiry before update on public.messages for each row execute function public.keep_expiry();

-- deletes expired messages and expired stories. (Files in storage can't be removed from SQL; expired
-- story files stay unreadable through the policies below and can be cleaned up with the Storage API.)
create or replace function public.purge_expired() returns void language sql security definer set search_path = public as $$
  delete from public.messages where expires_at is not null and expires_at < now();
  delete from public.group_messages where expires_at is not null and expires_at < now();
  delete from public.stories where visible_until < now() - interval '1 day';
$$;
revoke all on function public.purge_expired() from public, anon, authenticated;

-- run it every 10 minutes (pg_cron is available on this project but not switched on yet)
create extension if not exists pg_cron;
select cron.unschedule('chatter-purge-expired') where exists (select 1 from cron.job where jobname = 'chatter-purge-expired');
select cron.schedule('chatter-purge-expired', '*/10 * * * *', 'select public.purge_expired()');

-- ---------- 2. Story audience and media ----------
alter table public.stories add column if not exists audience text not null default 'contacts';
alter table public.stories drop constraint if exists stories_audience_check;
alter table public.stories add constraint stories_audience_check check (audience in ('contacts','close','only','except'));
alter table public.stories add column if not exists audience_ids uuid[] not null default '{}';
alter table public.stories add column if not exists media_key text;
alter table public.stories add column if not exists music_key text;
-- a story can only point at files in its own author's folder, so it can't be used to read someone else's file
alter table public.stories drop constraint if exists stories_files_own;
alter table public.stories add constraint stories_files_own check (
  (media_key is null or media_key like 'story/' || author_id::text || '/%')
  and (music_key is null or music_key like 'story/' || author_id::text || '/%'));
alter table public.stories drop constraint if exists stories_audience_ids_len;
alter table public.stories add constraint stories_audience_ids_len check (cardinality(audience_ids) <= 500);

-- who may see one story: the author; otherwise someone who passes can_see_story and the audience rule
create or replace function public.can_see_story_row(p_author uuid, p_audience text, p_ids uuid[])
returns boolean language sql security definer stable set search_path = public as $$
  select p_author = auth.uid() or (
    public.can_see_story(p_author) and case p_audience
      when 'contacts' then true
      when 'close' then auth.uid() = any(p_ids)
      when 'only' then auth.uid() = any(p_ids)
      when 'except' then not (auth.uid() = any(p_ids))
      else false end
  );
$$;

drop policy if exists "read live stories" on public.stories;
create policy "read live stories" on public.stories for select to authenticated
  using (visible_until > now() and public.can_see_story_row(author_id, audience, audience_ids));

drop policy if exists "read reactions" on public.story_reactions;
create policy "read reactions" on public.story_reactions for select to authenticated using (exists (
  select 1 from public.stories s where s.id = story_id and s.visible_until > now() and public.can_see_story_row(s.author_id, s.audience, s.audience_ids)));
drop policy if exists "react to stories" on public.story_reactions;
create policy "react to stories" on public.story_reactions for insert to authenticated with check (user_id = auth.uid() and exists (
  select 1 from public.stories s where s.id = story_id and s.visible_until > now() and public.can_see_story_row(s.author_id, s.audience, s.audience_ids)));

-- ---------- 3. Story replies (text, emoji, GIF, picture, voice; public or private) ----------
create table if not exists public.story_replies (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('text','emoji','gif','picture','voice','story')),
  body text not null default '' check (char_length(body) <= 1000),
  media_key text,
  media_type text check (media_type is null or media_type ~ '^(image|audio|video)/[A-Za-z0-9.+-]{1,40}(;.*)?$'),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.story_replies drop constraint if exists story_replies_file_own;
alter table public.story_replies add constraint story_replies_file_own check (
  media_key is null or media_key like 'reply/' || story_id::text || '/' || author_id::text || '/%');
create index if not exists story_replies_story on public.story_replies (story_id, created_at);
alter table public.story_replies enable row level security;

-- public replies: anyone who can see the story; private ones: only the reply's author and the story's author
drop policy if exists "read story replies" on public.story_replies;
create policy "read story replies" on public.story_replies for select to authenticated using (exists (
  select 1 from public.stories s where s.id = story_id and s.visible_until > now()
    and public.can_see_story_row(s.author_id, s.audience, s.audience_ids)
    and (is_public or author_id = auth.uid() or s.author_id = auth.uid())));
drop policy if exists "reply to stories" on public.story_replies;
create policy "reply to stories" on public.story_replies for insert to authenticated with check (author_id = auth.uid() and exists (
  select 1 from public.stories s where s.id = story_id and s.visible_until > now()
    and public.can_see_story_row(s.author_id, s.audience, s.audience_ids)));
-- "reply with my story": the linked story (body) must be the replier's own
create or replace function public.story_reply_ok() returns trigger language plpgsql as $$
begin
  if new.kind = 'story' then
    if new.body !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or not exists (select 1 from public.stories s where s.id = new.body::uuid and s.author_id = new.author_id) then
      raise exception 'You can only reply with your own story';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists story_replies_check on public.story_replies;
create trigger story_replies_check before insert on public.story_replies for each row execute function public.story_reply_ok();

drop policy if exists "delete own or received replies" on public.story_replies;
create policy "delete own or received replies" on public.story_replies for delete to authenticated using (
  author_id = auth.uid() or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'story_replies') then
    alter publication supabase_realtime add table public.story_replies;
  end if;
end $$;

-- ---------- 4. Private storage for story photos, GIFs, videos, music and reply media (up to 8 MB; the app limits photos/GIFs to 2 MB, music to 4 MB) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-media', 'story-media', false, 8388608, array['image/gif','image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg','video/mp4','video/webm'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/gif','image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg','video/mp4','video/webm'];

-- story/<me>/<id>.<ext>   and   reply/<story id>/<me>/<id>.<ext>
drop policy if exists "story media: upload" on storage.objects;
create policy "story media: upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'story-media' and (
    ((storage.foldername(name))[1] = 'story' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'reply' and (storage.foldername(name))[3] = auth.uid()::text
        and exists (select 1 from public.stories s where s.id::text = (storage.foldername(name))[2]
                    and s.visible_until > now() and public.can_see_story_row(s.author_id, s.audience, s.audience_ids)))
  ));

drop policy if exists "story media: open" on storage.objects;
create policy "story media: open" on storage.objects for select to authenticated using (
  bucket_id = 'story-media' and (
    ((storage.foldername(name))[1] = 'story' and (storage.foldername(name))[2] = auth.uid()::text)
    or exists (select 1 from public.stories s where (s.media_key = name or s.music_key = name) and s.visible_until > now()
               and public.can_see_story_row(s.author_id, s.audience, s.audience_ids))
    or exists (select 1 from public.story_replies r join public.stories s on s.id = r.story_id
               where r.media_key = name and s.visible_until > now()
                 and public.can_see_story_row(s.author_id, s.audience, s.audience_ids)
                 and (r.is_public or r.author_id = auth.uid() or s.author_id = auth.uid()))
  ));

drop policy if exists "story media: delete own" on storage.objects;
create policy "story media: delete own" on storage.objects for delete to authenticated using (
  bucket_id = 'story-media' and (
    ((storage.foldername(name))[1] = 'story' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'reply' and (storage.foldername(name))[3] = auth.uid()::text)
  ));
