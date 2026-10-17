-- Files and voice messages in chats (up to 1 MB each). NOT APPLIED YET: run it in the Supabase SQL Editor.
-- Until then, sending a file or voice message in a real chat shows
-- "File sharing isn't switched on for this server yet". Decoy chats don't use this at all.
--
-- Layout (checked by the rules below):
--   dm/<sender>/<recipient>/<random id>/<file name>
--   group/<group id>/<sender>/<random id>/<file name>
-- The bucket is private: files are opened through short-lived signed links, never public URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 1048576, null)
on conflict (id) do update set public = false, file_size_limit = 1048576;

-- folder name → uuid, or null if it isn't one (so a malformed path is refused, not an error)
create or replace function public.attachment_uuid(p text)
returns uuid language sql immutable as $$
  select case when p ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end;
$$;

-- true if either person has blocked the other
create or replace function public.attachment_blocked(a uuid, b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  -- only answers for the person asking (a must be the caller), so it can't be used to look up other people's blocks
  select a = auth.uid() and exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

drop policy if exists "attachments: send" on storage.objects;
create policy "attachments: send" on storage.objects for insert to authenticated
with check (
  bucket_id = 'attachments'
  and (
    ( (storage.foldername(name))[1] = 'dm'
      and public.attachment_uuid((storage.foldername(name))[2]) = auth.uid()
      and public.attachment_uuid((storage.foldername(name))[3]) is not null
      and public.attachment_uuid((storage.foldername(name))[3]) <> auth.uid()
      and not public.attachment_blocked(auth.uid(), public.attachment_uuid((storage.foldername(name))[3])) )
    or
    ( (storage.foldername(name))[1] = 'group'
      and public.attachment_uuid((storage.foldername(name))[3]) = auth.uid()
      and public.is_group_member(public.attachment_uuid((storage.foldername(name))[2])) )
  )
);

drop policy if exists "attachments: open" on storage.objects;
create policy "attachments: open" on storage.objects for select to authenticated
using (
  bucket_id = 'attachments'
  and (
    ( (storage.foldername(name))[1] = 'dm'
      and auth.uid() in (public.attachment_uuid((storage.foldername(name))[2]), public.attachment_uuid((storage.foldername(name))[3])) )
    or
    ( (storage.foldername(name))[1] = 'group'
      and public.is_group_member(public.attachment_uuid((storage.foldername(name))[2])) )
  )
);

-- only the sender can delete what they sent; nobody can overwrite a file
drop policy if exists "attachments: sender deletes" on storage.objects;
create policy "attachments: sender deletes" on storage.objects for delete to authenticated
using (
  bucket_id = 'attachments'
  and (
    ((storage.foldername(name))[1] = 'dm' and public.attachment_uuid((storage.foldername(name))[2]) = auth.uid())
    or ((storage.foldername(name))[1] = 'group' and public.attachment_uuid((storage.foldername(name))[3]) = auth.uid())
  )
);

revoke all on function public.attachment_blocked(uuid, uuid) from public, anon;
grant execute on function public.attachment_blocked(uuid, uuid) to authenticated;
