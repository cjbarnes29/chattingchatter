-- Signed-out visitors have no reason to call these through the API. Signed-in users keep access
-- (policies and the app use them); the new-user trigger needs no direct access from anyone.
revoke execute on function public.can_see_story(uuid) from public, anon;
revoke execute on function public.can_see_story_row(uuid, text, uuid[]) from public, anon;
revoke execute on function public.create_group(text, text, uuid[]) from public, anon;
revoke execute on function public.find_profiles_by_emails(text[]) from public, anon;
revoke execute on function public.is_blocked_pair(uuid, uuid) from public, anon;
revoke execute on function public.is_group_admin(uuid) from public, anon;
revoke execute on function public.is_group_member(uuid) from public, anon;
grant execute on function public.can_see_story(uuid) to authenticated;
grant execute on function public.can_see_story_row(uuid, text, uuid[]) to authenticated;
grant execute on function public.create_group(text, text, uuid[]) to authenticated;
grant execute on function public.find_profiles_by_emails(text[]) to authenticated;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
