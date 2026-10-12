-- App unica (Ledger + Frame): uno schema solo.
-- Da incollare in Supabase → SQL Editor → Run (una volta sola; rilanciarlo non rompe niente).
--
-- Ogni utente ha un documento JSON per modulo: 'profilo' (nome, moduli scelti), 'ledger', 'frame', 'frame-foto'.
-- `versione` sale a ogni salvataggio: serve a PC e telefono per non cancellarsi a vicenda (vedi shared/sync.js).
-- Le regole RLS fanno sì che ognuno legga e scriva solo le sue righe.

create table if not exists public.documenti (
  user_id    uuid not null references auth.users (id) on delete cascade,
  modulo     text not null check (modulo ~ '^[a-z0-9-]{1,40}$'),
  dati       jsonb not null default '{}'::jsonb,
  versione   integer not null default 1,
  aggiornato timestamptz not null default now(),
  primary key (user_id, modulo)
);

alter table public.documenti enable row level security;

drop policy if exists "leggo solo i miei"    on public.documenti;
drop policy if exists "creo solo i miei"     on public.documenti;
drop policy if exists "modifico solo i miei" on public.documenti;
drop policy if exists "cancello solo i miei" on public.documenti;

create policy "leggo solo i miei"    on public.documenti for select to authenticated using (auth.uid() = user_id);
create policy "creo solo i miei"     on public.documenti for insert to authenticated with check (auth.uid() = user_id);
create policy "modifico solo i miei" on public.documenti for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cancello solo i miei" on public.documenti for delete to authenticated using (auth.uid() = user_id);
