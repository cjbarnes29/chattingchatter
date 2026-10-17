-- INTERFACE PREFERENCES (theme, layout, navigation, dashboard)
-- One row per user holding presentation choices only. No secrets or credentials belong here.
create table if not exists public.ui_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object' and pg_column_size(prefs) < 16384),
  updated_at timestamptz not null default now()
);
alter table public.ui_prefs enable row level security;

-- Each user can only see and change their own row.
drop policy if exists "read own ui prefs" on public.ui_prefs;
create policy "read own ui prefs" on public.ui_prefs for select to authenticated using (user_id = auth.uid());
drop policy if exists "insert own ui prefs" on public.ui_prefs;
create policy "insert own ui prefs" on public.ui_prefs for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "update own ui prefs" on public.ui_prefs;
create policy "update own ui prefs" on public.ui_prefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "delete own ui prefs" on public.ui_prefs;
create policy "delete own ui prefs" on public.ui_prefs for delete to authenticated using (user_id = auth.uid());

revoke all on public.ui_prefs from anon;
