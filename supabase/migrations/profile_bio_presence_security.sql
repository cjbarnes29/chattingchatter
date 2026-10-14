alter table public.profiles add column if not exists nickname text not null default '';
alter table public.profiles add column if not exists age int;
alter table public.profiles add column if not exists status text not null default '';
alter table public.profiles add column if not exists presence_mode text not null default 'auto';
alter table public.profiles add column if not exists last_seen timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_presence_mode_chk') then
    alter table public.profiles add constraint profiles_presence_mode_chk check (presence_mode in ('auto','online','offline'));
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_age_chk') then
    alter table public.profiles add constraint profiles_age_chk check (age is null or (age between 13 and 120));
  end if;
end $$;

create table if not exists public.user_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  question text not null,
  answer_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.user_security enable row level security;

create or replace function public.get_security_question() returns text
language sql security definer set search_path = public as $$
  select question from public.user_security where user_id = auth.uid()
$$;

create or replace function public.check_security_answer(p_answer text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select answer_hash into h from public.user_security where user_id = auth.uid();
  if h is null then return false; end if;
  return h = crypt(lower(trim(p_answer)), h);
end $$;

create or replace function public.set_security_question(p_question text, p_answer text, p_old_answer text default null) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  if auth.uid() is null then return 'not-signed-in'; end if;
  if length(trim(p_question)) < 4 or length(trim(p_answer)) < 2 then return 'invalid'; end if;
  select answer_hash into h from public.user_security where user_id = auth.uid();
  if h is not null and (p_old_answer is null or h <> crypt(lower(trim(p_old_answer)), h)) then return 'wrong-answer'; end if;
  insert into public.user_security(user_id, question, answer_hash)
  values (auth.uid(), trim(p_question), crypt(lower(trim(p_answer)), gen_salt('bf')))
  on conflict (user_id) do update set question = excluded.question, answer_hash = excluded.answer_hash, updated_at = now();
  return 'ok';
end $$;

revoke all on function public.get_security_question() from public, anon;
revoke all on function public.check_security_answer(text) from public, anon;
revoke all on function public.set_security_question(text, text, text) from public, anon;
grant execute on function public.get_security_question() to authenticated;
grant execute on function public.check_security_answer(text) to authenticated;
grant execute on function public.set_security_question(text, text, text) to authenticated;