// Dove vivono i dati.
// - Con Supabase configurato (shared/config.js): stessa sessione dell'app, un documento per utente
//   (modulo "ledger"), copia sul dispositivo e sincronizzazione in shared/sync.js.
// - Senza: modalità demo nel browser (dati di esempio, salvati solo su questo dispositivo).
import { online as _online, utente, esci as _esci } from '../../shared/supa.js';
import { documento } from '../../shared/sync.js';
import { normalize, vuoto } from './model.js';
import { demo } from './demo.js';

const DEMO_KEY = 'ledger-demo-v2';
export const online = _online;
let user = null, doc = null, demoT = null, listeners = [];
export let state = null;
export let saving = 'salvato';

export async function sessione() {
  if (!online) return { demo: true };
  user = await utente();
  return user ? { user } : null;
}

export const esci = () => _esci();
export const email = () => user?.email || '';

export async function carica() {
  if (!online) {
    let raw = null;
    try { raw = localStorage.getItem(DEMO_KEY); } catch {}
    state = raw ? normalize(JSON.parse(raw)) : demo();
    return state;
  }
  doc = documento(user.id, 'ledger');
  const dati = await doc.carica();
  // primo avvio: il nome viene dal profilo dell'app (quello scelto all'invito)
  const profilo = dati ? null : await documento(user.id, 'profilo').carica({ sincronizza: false });
  state = dati ? normalize(dati) : vuoto(profilo?.nome || user.email.split('@')[0]);
  if (!dati) doc.salva(state);
  // modifiche arrivate dall'altro dispositivo
  doc.quandoCambia(nuovi => { state = normalize(nuovi); listeners.forEach(l => l()); });
  doc.quandoStato(s => { saving = s; listeners.forEach(l => l('saved')); });
  return state;
}

// ogni modifica passa da qui: aggiorna, ridisegna, salva
export function modifica(fn) {
  fn(state);
  state = normalize(state);
  listeners.forEach(l => l());
  if (online) { doc.salva(state); return; }
  clearTimeout(demoT);
  demoT = setTimeout(() => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); } catch {} }, 600);
}
export function sostituisci(nuovo) { modifica(s => { Object.keys(s).forEach(k => delete s[k]); Object.assign(s, nuovo); }); }
export const ascolta = fn => listeners.push(fn);
export function resetDemo() { try { localStorage.removeItem(DEMO_KEY); } catch {} location.reload(); }
