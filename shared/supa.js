// Collegamento a Supabase condiviso da tutta l'app: una sola sessione per Home, Ledger e Frame.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const online = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const AUTH_KEY = 'app-auth';
let sb = null;

export async function client() {
  if (!online) return null;
  if (!sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    // sessione lunga: resta salvata sul dispositivo e si rinnova da sola finché non premi Esci
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_KEY },
    });
  }
  return sb;
}

// utente collegato; senza rete usa quello salvato sul dispositivo, così l'app si apre anche offline
export async function utente() {
  if (!online) return null;
  const c = await client();
  try {
    const { data } = await c.auth.getSession();
    if (data.session?.user) return data.session.user;
  } catch {}
  if (!navigator.onLine) {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY))?.user || null; } catch {}
  }
  return null;
}

export async function esci() {
  try { const { svuotaCache } = await import('./sync.js'); await svuotaCache(); } catch {}
  try { ['ferro-v1', 'ferro-v1-owner'].forEach(k => localStorage.removeItem(k)); } catch {}
  if (online) { const c = await client(); await c.auth.signOut(); }
  location.href = '/';
}
