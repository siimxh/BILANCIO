// Collegamento banca (Enable Banking) per Ledger. Gira su Supabase come Edge Function "banca".
//
// La chiave privata di Enable Banking sta SOLO nei segreti di Supabase, mai nel telefono:
//   EB_APP_ID        = Application ID dal Control Panel di Enable Banking
//   EB_PRIVATE_KEY   = contenuto del file .pem dell'applicazione (-----BEGIN PRIVATE KEY----- …)
//   APP_URL          = indirizzo dell'app su Vercel, es. https://stack.vercel.app
//   BANCA_UTENTI     = email ammesse, separate da virgola (per ora solo Simone)
//   CRON_SEGRETO     = una parola lunga a caso, uguale a quella nel cron di supabase/banca.sql
// (SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY ci sono già da sole.)
//
// Azioni (POST con JSON { azione, … }):
//   collega      → { url } dove mandare la persona per autorizzare Revolut
//   ritorno      → { code, state } dal ritorno della banca: apre la sessione e salva i conti
//   sincronizza  → scarica i movimenti nuovi in banca_movimenti (anche dal cron, con x-cron-segreto)
//   stato        → conti collegati e scadenza del consenso
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const EB = 'https://api.enablebanking.com';
const env = (k: string) => Deno.env.get(k) ?? '';
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-cron-segreto', 'access-control-allow-methods': 'POST, OPTIONS' };
const risposta = (dati: unknown, status = 200) => new Response(JSON.stringify(dati), { status, headers: { ...CORS, 'content-type': 'application/json' } });

// ---------- JWT per Enable Banking (RS256, firmato con la chiave dell'applicazione) ----------
const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = ''; bytes.forEach(x => s += String.fromCharCode(x));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
let chiave: CryptoKey | null = null;
async function jwt() {
  if (!chiave) {
    const pem = env('EB_PRIVATE_KEY').replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
    chiave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  }
  const ora = Math.floor(Date.now() / 1000);
  const testa = b64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: env('EB_APP_ID') }));
  const corpo = b64url(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: ora, exp: ora + 3600 }));
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chiave, new TextEncoder().encode(testa + '.' + corpo));
  return testa + '.' + corpo + '.' + b64url(firma);
}
async function eb(metodo: string, percorso: string, body?: unknown) {
  const r = await fetch(EB + percorso, { method: metodo, headers: { authorization: 'Bearer ' + await jwt(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`Enable Banking ${r.status} su ${percorso}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
}

// ---------- movimenti ----------
const giorno = (d: Date) => d.toISOString().slice(0, 10);
async function idMovimento(t: any, conto: string) {
  const base = t.entry_reference || t.transaction_id;
  if (base) return conto + ':' + base;
  const firma = [t.booking_date, t.transaction_amount?.amount, t.credit_debit_indicator, (t.remittance_information || []).join(' ')].join('|');
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(firma));
  return conto + ':h' + b64url(h).slice(0, 22);
}
async function sincronizzaUtente(userId: string) {
  const { data: sessioni } = await admin.from('banca_sessioni').select('*').eq('user_id', userId).not('session_id', 'is', null);
  let nuovi = 0;
  for (const s of sessioni ?? []) {
    if (s.valido_fino && new Date(s.valido_fino) < new Date()) continue; // consenso scaduto: va ricollegato
    const dal = giorno(new Date(s.ultimo_sync ? Date.parse(s.ultimo_sync) - 7 * 864e5 : Date.now() - 90 * 864e5));
    for (const conto of s.conti ?? []) {
      let cont: string | undefined, righe: any[] = [];
      do {
        const q = new URLSearchParams({ date_from: dal }); if (cont) q.set('continuation_key', cont);
        const r = await eb('GET', `/accounts/${conto.uid}/transactions?${q}`);
        righe = righe.concat(r.transactions ?? []); cont = r.continuation_key || undefined;
      } while (cont);
      const daSalvare = [];
      for (const t of righe) {
        if (t.status && t.status !== 'BOOK') continue; // solo movimenti contabilizzati: i "pending" cambiano id quando passano
        const imp = Number(t.transaction_amount?.amount ?? 0) * (t.credit_debit_indicator === 'DBIT' ? -1 : 1);
        daSalvare.push({
          user_id: userId, conto: conto.uid, id_banca: await idMovimento(t, conto.uid),
          data: t.booking_date || t.value_date || t.transaction_date, importo: imp, valuta: t.transaction_amount?.currency ?? 'EUR',
          descrizione: (t.remittance_information || []).join(' ').trim() || null,
          controparte: (imp < 0 ? t.creditor?.name : t.debtor?.name) || null, grezzo: t,
        });
      }
      if (daSalvare.length) {
        const { error, count } = await admin.from('banca_movimenti').upsert(daSalvare, { onConflict: 'user_id,id_banca', ignoreDuplicates: true, count: 'exact' });
        if (error) throw error; nuovi += count ?? 0;
      }
      try {
        const b = await eb('GET', `/accounts/${conto.uid}/balances`);
        conto.saldo = b.balances?.[0]?.balance_amount ?? null; conto.saldo_il = new Date().toISOString();
      } catch { /* il saldo è un di più */ }
    }
    await admin.from('banca_sessioni').update({ ultimo_sync: new Date().toISOString(), conti: s.conti }).eq('id', s.id);
  }
  return nuovi;
}

// ---------- richieste ----------
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));

    // cron: sincronizza tutti gli utenti collegati
    if (req.headers.get('x-cron-segreto')) {
      if (req.headers.get('x-cron-segreto') !== env('CRON_SEGRETO') || !env('CRON_SEGRETO')) return risposta({ errore: 'no' }, 401);
      const { data } = await admin.from('banca_sessioni').select('user_id').not('session_id', 'is', null);
      const esito: Record<string, unknown> = {};
      for (const u of new Set((data ?? []).map(x => x.user_id))) {
        try { esito[u] = await sincronizzaUtente(u); } catch (e) { esito[u] = String(e); }
      }
      return risposta({ ok: true, esito });
    }

    // persona collegata (token di Supabase) e ammessa
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return risposta({ errore: 'Devi essere collegato.' }, 401);
    const ammessi = env('BANCA_UTENTI').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (!ammessi.includes((user.email ?? '').toLowerCase())) return risposta({ errore: 'Il collegamento banca non è attivo per questo account.' }, 403);

    if (body.azione === 'collega') {
      const state = crypto.randomUUID();
      const valido = new Date(Date.now() + 179 * 864e5).toISOString();
      await admin.from('banca_sessioni').insert({ user_id: user.id, state, banca: body.banca ?? 'Revolut' });
      const r = await eb('POST', '/auth', {
        access: { valid_until: valido },
        aspsp: { name: body.banca ?? 'Revolut', country: body.paese ?? 'IT' },
        state, redirect_url: env('APP_URL').replace(/\/$/, '') + '/banca/', psu_type: 'personal',
      });
      return risposta({ url: r.url });
    }

    if (body.azione === 'ritorno') {
      const { data: s } = await admin.from('banca_sessioni').select('*').eq('user_id', user.id).eq('state', body.state).maybeSingle();
      if (!s) return risposta({ errore: 'Collegamento non trovato o già usato. Riprova da Ledger.' }, 400);
      const r = await eb('POST', '/sessions', { code: body.code });
      const conti = (r.accounts ?? []).map((a: any) => ({ uid: a.uid, iban: a.account_id?.iban ?? null, nome: a.name ?? a.product ?? null, valuta: a.currency ?? null }));
      await admin.from('banca_sessioni').update({ session_id: r.session_id, conti, valido_fino: r.access?.valid_until ?? null, state: null }).eq('id', s.id);
      const nuovi = await sincronizzaUtente(user.id);
      return risposta({ ok: true, conti: conti.length, nuovi });
    }

    if (body.azione === 'sincronizza') return risposta({ ok: true, nuovi: await sincronizzaUtente(user.id) });

    if (body.azione === 'stato') {
      const { data } = await admin.from('banca_sessioni').select('banca, conti, valido_fino, ultimo_sync').eq('user_id', user.id).not('session_id', 'is', null);
      return risposta({ collegamenti: data ?? [] });
    }

    return risposta({ errore: 'azione sconosciuta' }, 400);
  } catch (e) {
    console.error(e);
    return risposta({ errore: String((e as Error).message ?? e) }, 500);
  }
});
