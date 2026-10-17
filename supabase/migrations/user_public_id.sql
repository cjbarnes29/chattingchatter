-- Unique, shareable user ID# (e.g. K7QM-4XZ2) so people can be added without sharing an email.
-- Crockford base32 alphabet: no I, L, O, U, so IDs are easy to read out and hard to mistype.

alter table public.profiles add column if not exists public_id text;

create or replace function public.gen_public_id() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where public_id = candidate);
  end loop;
  return candidate;
end $$;

-- backfill existing accounts
update public.profiles set public_id = public.gen_public_id() where public_id is null;

alter table public.profiles alter column public_id set default public.gen_public_id();
alter table public.profiles alter column public_id set not null;
create unique index if not exists profiles_public_id_key on public.profiles (public_id);

-- the ID is permanent: nobody (including the owner) can change it through the API
create or replace function public.keep_public_id() returns trigger
language plpgsql as $$
begin
  if new.public_id is distinct from old.public_id then
    new.public_id := old.public_id;
  end if;
  return new;
end $$;
drop trigger if exists profiles_keep_public_id on public.profiles;
create trigger profiles_keep_public_id before update on public.profiles for each row execute function public.keep_public_id();

-- exact-match lookup (same minimal fields as find_profile_by_email); hides blocked pairs
create or replace function public.find_profile_by_public_id(p_id text)
returns table (id uuid, name text, avatar text, about text)
language sql security definer set search_path = public stable as $$
  select p.id, p.name, p.avatar, p.about from public.profiles p
  where p.public_id = upper(regexp_replace(coalesce(p_id, ''), '[^0-9A-Za-z]', '', 'g'))
    and p.id <> auth.uid()
    and not public.is_blocked_pair(auth.uid(), p.id)
  limit 1
$$;
revoke all on function public.find_profile_by_public_id(text) from public, anon;
grant execute on function public.find_profile_by_public_id(text) to authenticated;
