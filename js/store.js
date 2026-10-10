// Dove vivono i dati.
// - Con Supabase configurato (js/config.js): login email+password, un documento per utente, protetto da RLS.
// - Senza: modalità demo nel browser (dati di esempio, salvati solo su questo dispositivo).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { normalize, vuoto } from './model.js';
import { demo } from './demo.js';

const DEMO_KEY = 'ledger-demo-v2';
export const online = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
let sb = null, user = null, saveT = null, listeners = [];
export let state = null;
export let saving = 'salvato';

export async function client() {
  if (!online) return null;
  if (!sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return sb;
}

export async function sessione() {
  if (!online) return { demo: true };
  const c = await client();
  const { data } = await c.auth.getSession();
  user = data.session?.user || null;
  return user ? { user } : null;
}

export async function accedi(email, password) {
  const c = await client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error; user = data.user; return user;
}
export async function registrati(email, password) {
  const c = await client();
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) throw error; user = data.user; return data;
}
export async function esci() {
  if (online) { const c = await client(); await c.auth.signOut(); }
  location.reload();
}
export const email = () => user?.email || '';

export async function carica() {
  if (!online) {
    let raw = null;
    try { raw = localStorage.getItem(DEMO_KEY); } catch {}
    state = raw ? normalize(JSON.parse(raw)) : demo();
    return state;
  }
  const c = await client();
  const { data, error } = await c.from('bilanci').select('dati').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  state = data?.dati ? normalize(data.dati) : vuoto(user.email.split('@')[0]);
  if (!data) await scriviOra();
  return state;
}

async function scriviOra() {
  if (!online) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); } catch {} return; }
  const c = await client();
  const { error } = await c.from('bilanci').upsert({ user_id: user.id, dati: state, aggiornato: new Date().toISOString() });
  if (error) throw error;
}

// ogni modifica passa da qui: aggiorna, ridisegna, salva dopo un attimo
export function modifica(fn) {
  fn(state);
  state = normalize(state);
  saving = 'salvataggio…';
  listeners.forEach(l => l());
  clearTimeout(saveT);
  saveT = setTimeout(async () => {
    try { await scriviOra(); saving = 'salvato'; } catch (e) { saving = 'errore nel salvataggio'; console.error(e); }
    listeners.forEach(l => l('saved'));
  }, 600);
}
export function sostituisci(nuovo) { modifica(s => { Object.keys(s).forEach(k => delete s[k]); Object.assign(s, nuovo); }); }
export const ascolta = fn => listeners.push(fn);
export function resetDemo() { try { localStorage.removeItem(DEMO_KEY); } catch {} location.reload(); }
