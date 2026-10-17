-- Found in the 17 Oct 2026 audit. NOT applied to the live database yet: it needs the owner's approval.
-- Apply in this order: fix_security_and_bugs.sql, receipts_and_typing.sql, then this file.
-- Nothing here changes what the app does for signed-in users; it only removes access nobody should have.

-- Helper functions were callable without signing in (anon key). Policies that use them run as the
-- signed-in user, so `authenticated` keeps EXECUTE.
revoke execute on function public.can_see_story(uuid) from public, anon;
revoke execute on function public.is_blocked_pair(uuid, uuid) from public, anon;
revoke execute on function public.is_group_admin(uuid) from public, anon;
revoke execute on function public.is_group_member(uuid) from public, anon;
grant execute on function public.can_see_story(uuid) to authenticated;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;

-- fix_security_and_bugs.sql revokes these too; repeated so this file is safe on its own.
revoke execute on function public.find_profiles_by_emails(text[]) from public, anon;
revoke execute on function public.create_group(text, text, uuid[]) from public, anon;
grant execute on function public.find_profiles_by_emails(text[]) to authenticated;
grant execute on function public.create_group(text, text, uuid[]) to authenticated;
