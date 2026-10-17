-- Pin the search_path of the helper functions added with user IDs and Ghost Canvas sessions
alter function public.gen_public_id() set search_path = public;
alter function public.keep_public_id() set search_path = public;
alter function public.ghost_sessions_guard() set search_path = public;
