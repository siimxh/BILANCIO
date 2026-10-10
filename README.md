# Ledger

Il tuo bilancio personale: entrate, spese, contanti, debiti, obiettivi e patrimonio, con i conti fatti "da commercialista".

Sito statico (HTML + JavaScript, niente build). Login e dati su Supabase, pubblicazione gratuita su Vercel.
Senza Supabase configurato parte in **modalità demo** con dati inventati.

## Sezioni
- **Dashboard**: conto economico del periodo, "oggi puoi spendere", cuscinetto, corsa della spesa, flusso, categorie, indicatori (risparmio, spese fisse, debiti, mesi di autonomia), pacing del patrimonio.
- **Movimenti**: prima nota, import estratto conto Revolut (CSV), contanti e "conta i contanti".
- **Impegni**: rate, debiti, abbonamenti, spese annuali, linea del tempo a 12 mesi.
- **Obiettivi**: quota al mese, in linea / in ritardo, ordine di priorità, salvadanai collegati.
- **Patrimonio**: netto oggi, composizione, previsione a fine trimestre / semestre / anno.
- **Resoconti**: mese per mese.
- **Impostazioni** (ingranaggio): regole a slider, tasse con data di inizio, conti, categorie, backup.

## Regole dei calcoli
- Spostamenti tra conti tuoi (prelievo, salvadanaio, investimenti) non sono né spese né entrate.
- I rimborsi abbassano le spese della loro categoria.
- Entrate "non da lavoro" (regali, famiglia) separate e senza tasse.
- Tasse da accantonare = % del regime in vigore il giorno dell'incasso (fino al 31/12/2026: 0%, incassi già netti; dal 01/01/2027: forfettario, % a slider).

## Messa online (una volta)
1. **Supabase** → nuovo progetto gratuito → SQL Editor → incolla `supabase/schema.sql` → Run.
2. Supabase → Project Settings → API: copia *Project URL* e *anon public key* in `js/config.js`.
3. **Vercel** → Add New → Project → importa questo repository → Framework: *Other* → Deploy.
4. Supabase → Authentication → URL Configuration: metti l'indirizzo Vercel come *Site URL*.

## Provarlo in locale
```
python3 -m http.server 8000
```
poi apri http://localhost:8000
