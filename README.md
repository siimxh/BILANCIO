# Stack

L'app personale che contiene **Ledger** (bilancio) e **Frame** (allenamenti, corpo, sonno).
Un login solo, su invito. Ognuno sceglie i moduli che usa. Dati su Supabase, online su Vercel.

Sito statico: HTML + JavaScript, niente build. Senza chiavi Supabase parte in **modalità demo** (dati solo sul dispositivo).

## Come è fatta
- `/` Home: login, link d'invito (crea la password), password dimenticata, scelta moduli. File `index.html`, `home.js`, `home.css`.
- `/ledger/` Ledger. `/frame/` Frame (`frame/ponte.js` lo collega al salvataggio comune senza toccarne la logica).
- `/banca/` collegamento Revolut (Enable Banking), attivo solo per le email in `BANCA_UTENTI`.
- `shared/` pezzi comuni: `config.js` (chiavi pubbliche Supabase), `supa.js` (sessione unica e lunga), `sync.js` (salvataggio), `brand.js` (nome dell'app e moduli).
- `supabase/schema.sql` tabella `documenti`: un JSON per utente e per modulo, con RLS. `supabase/banca.sql` tabelle banca + cron. `supabase/functions/banca/` Edge Function.

## Salvataggio
Ogni modulo salva un documento (`profilo`, `ledger`, `frame`, `frame-foto`). Si apre subito dalla copia sul dispositivo (IndexedDB), poi si allinea con Supabase. Offline le modifiche restano in coda. Ogni documento ha una `versione`: se PC e telefono salvano insieme, le due versioni si uniscono (merge a 3 vie, liste unite per `id`), nessuno cancella l'altro.

## Messa online
1. **Supabase** → nuovo progetto (regione EU) → SQL Editor: lancia `supabase/schema.sql`.
2. Supabase → Project Settings → API: *Project URL* e *anon key* in `shared/config.js`.
3. Supabase → Authentication → Sign In / Providers: togli "Allow new users to sign up" (si entra solo su invito).
4. Supabase → Authentication → URL Configuration: *Site URL* = indirizzo Vercel; in *Redirect URLs* aggiungi `https://<indirizzo>/**`.
5. Supabase → Authentication → Emails → SMTP: un SMTP vero (es. Gmail con password per le app), altrimenti le mail d'invito arrivano solo ai membri del progetto Supabase.
6. **Vercel** → Add New → Project → importa questo repository → Framework *Other* → Deploy.
7. Inviti: Supabase → Authentication → Users → *Invite user*.

### Banca (facoltativo)
1. Enable Banking → Control Panel → nuova applicazione (restricted) con redirect `https://<indirizzo>/banca/`, collega i tuoi conti Revolut.
2. Supabase → SQL Editor: lancia `supabase/banca.sql`.
3. Supabase → Edge Functions → nuova funzione `banca` con il codice di `supabase/functions/banca/index.ts`.
4. Edge Functions → Secrets: `EB_APP_ID`, `EB_PRIVATE_KEY` (il file .pem: solo qui, mai in chat), `APP_URL`, `BANCA_UTENTI`, `CRON_SEGRETO`.
5. Database → Extensions: attiva `pg_cron` e `pg_net`, poi lancia la parte cron in fondo a `banca.sql`.

## Provarla in locale
```
python3 -m http.server 8000
```
poi apri http://localhost:8000 (modalità demo).
