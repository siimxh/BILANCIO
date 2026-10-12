// Guscio dell'app: login, barra in alto, periodo scelto, cambio sezione.
import * as store from './store.js';
import { importaBanca } from './banca.js';
import { $, esc, icon, initTips, today, toast } from './util.js';
import { MODI, periodo, sposta, etichetta, daSistemare } from './engine.js';
import { formMovimento, apri, chiudi } from './views/forms.js';
import { dashboard } from './views/dashboard.js';
import { movimenti } from './views/movimenti.js';
import { impegni } from './views/impegni.js';
import { obiettivi } from './views/obiettivi.js';
import { patrimonio } from './views/patrimonio.js';
import { resoconti } from './views/resoconti.js';
import { impostazioni } from './views/impostazioni.js';

// nome del tool in alto a sinistra (si cambia solo qui)
const NOME = 'Ledger';

const SEZIONI = [
  ['dashboard', 'Dashboard', dashboard],
  ['movimenti', 'Movimenti', movimenti],
  ['impegni', 'Impegni', impegni],
  ['obiettivi', 'Obiettivi', obiettivi],
  ['patrimonio', 'Patrimonio', patrimonio],
  ['resoconti', 'Resoconti', resoconti],
];
const VIEWS = Object.fromEntries([...SEZIONI.map(([k, , f]) => [k, f]), ['impostazioni', impostazioni]]);

// periodo scelto: ricordato su questo dispositivo
let per;
try { per = JSON.parse(localStorage.getItem('bilancio-periodo')); } catch {}
if (!per?.start) per = periodo('mese', today());
const setPer = p => { per = p; try { localStorage.setItem('bilancio-periodo', JSON.stringify(p)); } catch {} render(); };

// ---------- telefono o PC ----------
// sul telefono vero parte da sola; sul PC si può forzare l'anteprima dentro una cornice
const mq = matchMedia('(max-width: 760px)');
let forzato = false;
try { forzato = localStorage.getItem('ledger-telefono') === '1'; } catch {}
const mobile = () => mq.matches || forzato;
function modo() {
  const h = document.documentElement;
  h.classList.toggle('m', mobile());
  h.classList.toggle('frame', forzato && !mq.matches);
  let fb = document.getElementById('framebar');
  if (forzato && !mq.matches) {
    if (!fb) { fb = document.createElement('div'); fb.id = 'framebar'; fb.className = 'framebar'; document.body.prepend(fb); }
    fb.innerHTML = '<span>Anteprima telefono: scorri e tocca come sul cellulare</span><button class="btn sm" id="pcview">Torna alla vista PC</button>';
    fb.querySelector('#pcview').onclick = () => setTelefono(false);
  } else fb?.remove();
}
export function setTelefono(on) { forzato = on; try { localStorage.setItem('ledger-telefono', on ? '1' : '0'); } catch {} modo(); render(); }
mq.addEventListener?.('change', () => { modo(); render(); });

const TAB = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/></svg>',
  mov: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
  obi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></svg>',
  altro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/></svg>',
  tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2" stroke-linecap="round"/></svg>',
};

function mtop() {
  const nome = store.state.profilo.nome || store.email() || 'Tu';
  return `${forzato && !mq.matches ? '<div class="notch"><i></i></div>' : ''}<header class="mtop">
    <a class="logo" href="/" title="Torna alla Home"><i></i>${NOME}</a>
    <div class="right"><div class="per"><button class="chip" id="perbtn">${esc(etichetta(per))} ▾</button><div class="perpop" id="perpop" hidden></div></div>
    <span class="avatar" style="width:34px;height:34px" title="${esc(nome)}">${esc(nome.charAt(0).toUpperCase())}</span></div>
  </header>`;
}
function tabbar() {
  const cur = sezione(), n = daSistemare(store.state).length;
  const altro = ['impegni', 'patrimonio', 'resoconti', 'impostazioni'].includes(cur);
  return `<nav class="tabbar"><div class="bar">
    <button data-go="dashboard" class="${cur === 'dashboard' ? 'on' : ''}">${TAB.home}Home</button>
    <button data-go="movimenti" class="tb ${cur === 'movimenti' ? 'on' : ''}">${n ? '<span class="blink"></span>' : ''}${TAB.mov}Movimenti</button>
    <button class="plus" id="tplus" aria-label="Nuovo movimento">＋</button>
    <button data-go="obiettivi" class="${cur === 'obiettivi' ? 'on' : ''}">${TAB.obi}Obiettivi</button>
    <button id="taltro" class="${altro ? 'on' : ''}">${TAB.altro}Altro</button>
  </div></nav>`;
}
function menuAltro() {
  apri('Altro', `<div class="sheet">
    <button data-v="impegni">Impegni <span>rate, debiti, abbonamenti</span></button>
    <button data-v="patrimonio">Patrimonio <span>quanto vali, dove arrivi</span></button>
    <button data-v="resoconti">Resoconti <span>mese per mese</span></button>
    <button data-v="impostazioni">Impostazioni <span>le tue regole</span></button>
    ${forzato && !mq.matches ? '<button data-v="pc">Torna alla vista PC</button>' : ''}
  </div>`, d => d.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { chiudi(); if (b.dataset.v === 'pc') setTelefono(false); else vai(b.dataset.v); }));
}

const sezione = () => { const h = location.hash.slice(1).split('/')[0]; return VIEWS[h] ? h : 'dashboard'; };
export const sotto = () => location.hash.slice(1).split('/')[1] || '';
export const vai = k => { location.hash = k; };

function nav() {
  const cur = sezione(), nome = store.state.profilo.nome || store.email() || 'Tu';
  return `<nav class="nav">
    <a class="logo" href="/" title="Torna alla Home"><i></i>${NOME}</a>
    <div class="pills">${SEZIONI.map(([k, t]) => `<button data-go="${k}" class="${k === cur ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="right">
      <div class="per"><button class="chip" id="perbtn">${esc(etichetta(per))} ▾</button><div class="perpop" id="perpop" hidden></div></div>
      <button class="icbtn" id="telbtn" aria-label="Anteprima telefono" title="Vedi come sul telefono">${TAB.tel}</button>
      <button class="icbtn ${cur === 'impostazioni' ? 'on' : ''}" data-go="impostazioni" aria-label="Impostazioni" title="Impostazioni">${icon.gear}</button>
      <span class="avatar" title="${esc(nome)}">${esc(nome.charAt(0).toUpperCase())}</span>
    </div>
  </nav>`;
}

function perPop() {
  const pop = $('#perpop');
  const draw = () => {
    pop.innerHTML = `
      <div class="seg">${Object.entries(MODI).map(([k, t]) => `<button data-m="${k}" class="${per.modo === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${per.modo === 'custom' ? `<div class="fr"><label class="f">Dal<input type="date" id="pdA" value="${per.start}"></label><label class="f">Al<input type="date" id="pdB" value="${per.end}"></label></div>`
        : `<div class="perrow"><button class="arrow" data-d="-1" aria-label="Prima">‹</button><span class="lbl">${esc(etichetta(per))}</span><button class="arrow" data-d="1" aria-label="Dopo">›</button></div>`}
      <div class="btns"><button class="btn sm ghost" data-oggi>Torna a oggi</button></div>`;
  };
  draw();
  pop.onclick = e => {
    e.stopPropagation();
    const m = e.target.closest('[data-m]')?.dataset.m, d = e.target.closest('[data-d]')?.dataset.d;
    if (m) { per = m === 'custom' ? { modo: 'custom', start: per.start, end: per.end } : periodo(m, per.start <= today() && per.end >= today() ? today() : per.start); setPer(per); openPop(); }
    else if (d) { setPer(sposta(per, +d)); openPop(); }
    else if (e.target.closest('[data-oggi]')) { setPer(periodo(per.modo === 'custom' ? 'mese' : per.modo, today())); }
  };
  pop.onchange = () => { const a = $('#pdA').value, b = $('#pdB').value; if (a && b && a <= b) setPer({ modo: 'custom', start: a, end: b }), openPop(); };
}
function openPop() { const pop = $('#perpop'); pop.hidden = false; perPop(); }

export function render() {
  const app = $('#app'), k = sezione(), m = mobile();
  app.innerHTML = m ? mtop() + '<main id="view"></main>' + tabbar() : nav() + '<main id="view"></main>';
  VIEWS[k]($('#view'), { s: store.state, per, setPer, render, vai, sotto: sotto(), mobile: m });
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => vai(b.dataset.go));
  $('#telbtn')?.addEventListener('click', () => setTelefono(true));
  $('#tplus')?.addEventListener('click', () => formMovimento());
  $('#taltro')?.addEventListener('click', menuAltro);
  $('#perbtn').onclick = e => { e.stopPropagation(); const pop = $('#perpop'); if (pop.hidden) openPop(); else pop.hidden = true; };
}
document.addEventListener('click', e => { const pop = $('#perpop'); if (pop && !pop.hidden && !e.target.closest('.per')) pop.hidden = true; });

async function avvia() {
  await store.carica();
  store.ascolta(ev => { if (ev !== 'saved') render(); else { const t = document.querySelector('[data-saving]'); if (t) t.textContent = store.saving; } });
  window.addEventListener('hashchange', () => { render(); $('#app').scrollTop = 0; window.scrollTo(0, 0); });
  render();
  banca();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') banca(); });
}

// movimenti nuovi da Revolut: arrivano da soli, quelli sconosciuti vanno in "Da sistemare"
let inBanca = false;
async function banca() {
  if (inBanca || !store.online) return;
  inBanca = true;
  try {
    const r = await importaBanca(store.state, store.modifica);
    if (r?.nuovi) toast(`${r.nuovi} ${r.nuovi === 1 ? 'movimento nuovo' : 'movimenti nuovi'} da Revolut${r.daSistemare ? `, ${r.daSistemare} da sistemare` : ''}`);
  } catch (e) { console.error(e); }
  inBanca = false;
}

initTips();
modo();
(async () => {
  try {
    const ses = await store.sessione();
    if (!ses) location.replace('/'); else await avvia(); // il login è nella Home dell'app
  } catch (e) { console.error(e); $('#app').innerHTML = `<div class="login"><section class="card"><h3>Qualcosa non va</h3><p class="kid">${esc(e.message)}</p></section></div>`; }
})();
export { toast };
