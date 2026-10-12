// Ponte tra Frame e il salvataggio comune (shared/sync.js), senza toccare la logica di Frame.
//
// Frame continua a leggere e scrivere il suo stato in localStorage ("ferro-v1").
// Il ponte: 1) prima di avviarlo mette in localStorage i dati più recenti (dispositivo + server),
// 2) ogni volta che Frame salva, manda la modifica a Supabase, 3) se arriva una modifica
// dall'altro dispositivo la passa allo stato di Frame e ridisegna.
// Le foto viaggiano in un documento a parte ("frame-foto"), così non si rispediscono a ogni tocco.
import { online, utente } from '../shared/supa.js';
import { documento } from '../shared/sync.js';

const KEY = 'ferro-v1', OWNER = 'ferro-v1-owner';
const setOrig = Storage.prototype.setItem;
const leggiLocale = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const scriviLocale = o => { try { setOrig.call(localStorage, KEY, JSON.stringify(o)); } catch {} };
const dividi = o => { const { photos = [], ...resto } = o; return [resto, { photos }]; };
const unito = (d, f) => d ? { ...d, photos: f?.photos || [] } : null;

function avviaFrame() {
  const s = document.getElementById('frame-main'), n = document.createElement('script');
  n.textContent = s.textContent;
  document.body.appendChild(n);
}

(async () => {
  if (!online) { avviaFrame(); return; } // modalità demo: Frame da solo sul dispositivo
  const u = await utente();
  if (!u) { location.replace('/'); return; }

  // stesso telefono, persona diversa: non mostrare i dati di chi c'era prima
  try { if (localStorage.getItem(OWNER) !== u.id) { localStorage.removeItem(KEY); setOrig.call(localStorage, OWNER, u.id); } } catch {}

  const doc = documento(u.id, 'frame'), foto = documento(u.id, 'frame-foto');
  await Promise.all([doc.carica({ sincronizza: false }), foto.carica({ sincronizza: false })]);

  // quello che Frame ha salvato qui ma non è ancora arrivato in cache (app chiusa di colpo) conta come modifica mia
  const loc = leggiLocale();
  if (loc && !loc.sample) { const [d, f] = dividi(loc); doc.salva(d); foto.salva(f); }

  // poi il server, ma senza bloccare l'apertura più di 4 secondi (rete lenta o assente)
  const attesa = new Promise(r => setTimeout(r, 4000));
  await Promise.race([Promise.all([doc.sincronizza(), foto.sincronizza()]), attesa]);
  const pronto = unito(doc.dati, foto.dati);
  if (pronto) scriviLocale(pronto);

  // ogni salvataggio di Frame passa anche dal ponte
  Storage.prototype.setItem = function (k, v) {
    setOrig.call(this, k, v);
    if (this === localStorage && k === KEY) {
      try { const o = JSON.parse(v); if (!o.sample) { const [d, f] = dividi(o); doc.salva(d); foto.salva(f); } } catch {}
    }
  };

  // modifiche dall'altro dispositivo: aggiorno lo stato di Frame (S) tenendo l'allenamento in corso
  let ridisegna = false;
  const applica = () => {
    const nuovo = unito(doc.dati, foto.dati);
    if (!nuovo || typeof S === 'undefined') return;
    // eslint-disable-next-line no-undef
    S = Object.assign(blank(), nuovo, { active: S.active, draft: S.draft });
    scriviLocale(S);
    if (document.activeElement?.matches('input, textarea, select')) ridisegna = true; // non rubare il campo che stai scrivendo
    else render(); // eslint-disable-line no-undef
  };
  document.addEventListener('focusout', () => { if (ridisegna) { ridisegna = false; setTimeout(() => { if (!document.activeElement?.matches('input, textarea, select')) render(); }, 0); } }); // eslint-disable-line no-undef
  doc.quandoCambia(applica);
  foto.quandoCambia(applica);

  avviaFrame();
})();
