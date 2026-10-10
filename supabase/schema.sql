-- Bilancio: un documento JSON per utente, leggibile e scrivibile solo dal suo proprietario.
-- Da incollare in Supabase → SQL Editor → Run (una volta sola).

create table if not exists public.bilanci (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  dati       jsonb not null default '{}'::jsonb,
  aggiornato timestamptz not null default now()
);

alter table public.bilanci enable row level security;

drop policy if exists "leggo solo i miei" on public.bilanci;
drop policy if exists "creo solo i miei" on public.bilanci;
drop policy if exists "modifico solo i miei" on public.bilanci;
drop policy if exists "cancello solo i miei" on public.bilanci;

create policy "leggo solo i miei"    on public.bilanci for select using (auth.uid() = user_id);
create policy "creo solo i miei"     on public.bilanci for insert with check (auth.uid() = user_id);
create policy "modifico solo i miei" on public.bilanci for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cancello solo i miei" on public.bilanci for delete using (auth.uid() = user_id);
