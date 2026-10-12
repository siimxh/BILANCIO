-- Collegamento banca (Enable Banking). Da lanciare DOPO schema.sql, in Supabase → SQL Editor → Run.
-- Scrive solo la Edge Function "banca" (con la chiave di servizio); dal telefono si può solo leggere il proprio.

create table if not exists public.banca_sessioni (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  banca       text not null default 'Revolut',
  state       text unique,               -- usato solo durante il collegamento
  session_id  text,                      -- sessione Enable Banking (vale fino a valido_fino, max 180 giorni)
  conti       jsonb not null default '[]'::jsonb,
  valido_fino timestamptz,
  ultimo_sync timestamptz,
  creato      timestamptz not null default now()
);

create table if not exists public.banca_movimenti (
  user_id      uuid not null references auth.users (id) on delete cascade,
  id_banca     text not null,            -- id stabile del movimento (conto:riferimento)
  conto        text not null,
  data         date not null,
  importo      numeric(12,2) not null,   -- negativo = uscita
  valuta       text not null default 'EUR',
  descrizione  text,
  controparte  text,
  grezzo       jsonb,
  importato_il timestamptz not null default now(),
  primary key (user_id, id_banca)
);
create index if not exists banca_movimenti_recenti on public.banca_movimenti (user_id, importato_il);

alter table public.banca_sessioni  enable row level security;
alter table public.banca_movimenti enable row level security;
drop policy if exists "leggo solo i miei" on public.banca_sessioni;
drop policy if exists "leggo solo i miei" on public.banca_movimenti;
create policy "leggo solo i miei" on public.banca_sessioni  for select to authenticated using (auth.uid() = user_id);
create policy "leggo solo i miei" on public.banca_movimenti for select to authenticated using (auth.uid() = user_id);
-- dal telefono niente scritture, e la sessione Enable Banking resta nascosta
revoke all on public.banca_sessioni, public.banca_movimenti from anon, authenticated;
grant select on public.banca_movimenti to authenticated;
grant select (id, user_id, banca, conti, valido_fino, ultimo_sync, creato) on public.banca_sessioni to authenticated;

-- ---------- sync automatico 4 volte al giorno (7, 12, 17, 22 ora italiana circa) ----------
-- Prima: Database → Extensions → attiva pg_cron e pg_net.
-- Sostituisci i tre valori tra < > e lancia anche questa parte.
--
-- select cron.schedule('banca-sync', '0 5,10,15,20 * * *', $$
--   select net.http_post(
--     url     := 'https://<ID-PROGETTO>.supabase.co/functions/v1/banca',
--     headers := jsonb_build_object(
--       'content-type', 'application/json',
--       'authorization', 'Bearer <ANON-KEY>',
--       'x-cron-segreto', '<CRON_SEGRETO>'),
--     body    := '{}'::jsonb);
-- $$);
