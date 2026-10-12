// Salvataggio comune a tutti i moduli: un documento JSON per utente e per modulo (tabella `documenti`).
//
// - Prima il dispositivo: l'app si apre subito dalla copia locale (IndexedDB), anche senza rete.
// - Poi Supabase: ogni modifica parte dopo un attimo; se sei offline resta in coda e parte quando torna la rete.
// - PC e telefono non si cancellano a vicenda: ogni documento ha un numero di versione e,
//   se nel frattempo l'altro dispositivo ha salvato, le due versioni si uniscono (merge a 3 vie).
import { client, online } from './supa.js';

const DB = 'app-cache', STORE = 'docs';
let dbP = null;
function idb() {
  if (!dbP) dbP = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbP;
}
async function leggi(k) {
  try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  catch { return undefined; }
}
async function scrivi(k, v) {
  try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
  catch (e) { console.warn('cache locale non disponibile', e); }
}
export async function svuotaCache() {
  try { const db = await idb(); await new Promise(res => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).clear(); t.oncomplete = res; t.onerror = res; }); } catch {}
}

// ---------- merge a 3 vie ----------
// base = ultima versione sincronizzata, loc = la mia, rem = quella sul server.
// Oggetti: chiave per chiave. Liste di oggetti con `id`: elemento per elemento (aggiunte e cancellazioni
// di entrambi i lati sopravvivono). Se lo stesso valore cambia da tutte e due le parti vince il mio.
const uguali = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const oggetto = x => x && typeof x === 'object' && !Array.isArray(x);
const conId = x => Array.isArray(x) && x.every(e => oggetto(e) && e.id != null);

export function unisci(base, loc, rem) {
  if (uguali(loc, base)) return rem;
  if (uguali(rem, base)) return loc;
  if (oggetto(loc) && oggetto(rem)) {
    const b = oggetto(base) ? base : {}, out = {};
    for (const k of new Set([...Object.keys(rem), ...Object.keys(loc)])) {
      const v = unisci(b[k], loc[k], rem[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (conId(loc) && conId(rem)) {
    const mappa = a => new Map((conId(a) ? a : []).map(e => [String(e.id), e]));
    const B = mappa(base), L = mappa(loc), R = mappa(rem), out = [];
    const ids = [...R.keys(), ...[...L.keys()].filter(id => !R.has(id))];
    for (const id of ids) {
      const v = unisci(B.get(id), L.get(id), R.get(id));
      if (v !== undefined) out.push(v);
    }
    return out;
  }
  return loc;
}

// ---------- documento ----------
// const doc = documento(userId, 'ledger');
// const dati = await doc.carica();      → copia locale (o del server se è la prima volta su questo dispositivo)
// doc.salva(dati);                      → salva qui subito, sul server dopo un attimo
// doc.quandoCambia(nuovi => …);         → arrivano modifiche fatte da un altro dispositivo
// doc.quandoStato(s => …);              → 'salvato' | 'salvataggio…' | 'offline: salvo appena torna la rete' | 'errore nel salvataggio'
export function documento(userId, modulo, { attesa = 800 } = {}) {
  const chiave = `${userId}:${modulo}`;
  let c = { dati: null, base: null, versione: 0, sporco: false }; // versione 0 = mai salvato sul server
  let timer = null, inCorso = null, cbCambia = [], cbStato = [], stato = 'salvato';
  const setStato = s => { if (s !== stato) { stato = s; cbStato.forEach(f => f(s)); } };
  const persisti = () => scrivi(chiave, c);

  async function remoto() {
    const sb = await client();
    const { data, error } = await sb.from('documenti').select('dati, versione').eq('user_id', userId).eq('modulo', modulo).maybeSingle();
    if (error) throw error;
    return data; // null se non esiste ancora
  }

  // allinea con il server: scarica se c'è di nuovo, unisce se ho modifiche mie, poi spinge
  async function sincronizza() {
    if (!online || !navigator.onLine) { if (c.sporco) setStato('offline: salvo appena torna la rete'); return; }
    if (inCorso) return inCorso;
    inCorso = (async () => {
      try {
        for (let tentativo = 0; tentativo < 4; tentativo++) {
          const r = await remoto();
          if (r && r.versione > c.versione) {
            const prima = c.dati;
            c.dati = c.sporco && c.dati != null ? unisci(c.base, c.dati, r.dati) : r.dati;
            c.base = r.dati; c.versione = r.versione;
            c.sporco = c.sporco && !uguali(c.dati, r.dati);
            await persisti();
            if (!uguali(prima, c.dati)) cbCambia.forEach(f => f(c.dati));
          }
          if (!c.sporco || c.dati == null) { setStato('salvato'); return; }
          setStato('salvataggio…');
          const sb = await client(), ora = new Date().toISOString();
          let ok;
          if (!r) {
            const { error } = await sb.from('documenti').insert({ user_id: userId, modulo, dati: c.dati, versione: 1, aggiornato: ora });
            if (error && error.code !== '23505') throw error; // 23505 = l'altro dispositivo l'ha appena creato: riprovo
            ok = !error;
          } else {
            const { data, error } = await sb.from('documenti').update({ dati: c.dati, versione: c.versione + 1, aggiornato: ora })
              .eq('user_id', userId).eq('modulo', modulo).eq('versione', c.versione).select('versione');
            if (error) throw error;
            ok = data.length > 0; // 0 righe = qualcun altro ha salvato prima di me: riscarico e unisco
          }
          if (ok) { c.base = c.dati; c.versione = r ? c.versione + 1 : 1; c.sporco = false; await persisti(); setStato('salvato'); return; }
        }
        throw new Error('troppi salvataggi in contemporanea');
      } catch (e) {
        console.error(e);
        setStato(navigator.onLine ? 'errore nel salvataggio' : 'offline: salvo appena torna la rete');
      } finally { inCorso = null; }
    })();
    return inCorso;
  }

  const riprova = () => { if (document.visibilityState !== 'hidden') sincronizza(); };
  addEventListener('online', riprova);
  document.addEventListener('visibilitychange', riprova);

  return {
    // { sincronizza: false } = solo la copia sul dispositivo, senza toccare il server
    async carica({ sincronizza: sync = true } = {}) {
      const salvato = await leggi(chiave);
      if (salvato) c = salvato;
      if (!sync) return c.dati;
      if (c.dati == null && online && navigator.onLine) await sincronizza(); // primo avvio qui: aspetto il server
      else sincronizza();
      return c.dati;
    },
    salva(dati) {
      const copia = JSON.parse(JSON.stringify(dati));
      if (uguali(copia, c.dati)) return;
      c.dati = copia; c.sporco = true; persisti();
      if (!online) return;
      setStato(navigator.onLine ? 'salvataggio…' : 'offline: salvo appena torna la rete');
      clearTimeout(timer);
      timer = setTimeout(sincronizza, attesa);
    },
    sincronizza,
    get dati() { return c.dati; },
    get stato() { return stato; },
    quandoCambia: f => cbCambia.push(f),
    quandoStato: f => cbStato.push(f),
  };
}
