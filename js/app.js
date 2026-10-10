// Guscio dell'app: login, barra in alto, periodo scelto, cambio sezione.
import * as store from './store.js';
import { $, esc, icon, initTips, today, toast } from './util.js';
import { MODI, periodo, sposta, etichetta } from './engine.js';
import { dashboard } from './views/dashboard.js';
import { movimenti } from './views/movimenti.js';
import { impegni } from './views/impegni.js';
import { obiettivi } from './views/obiettivi.js';
import { patrimonio } from './views/patrimonio.js';
import { resoconti } from './views/resoconti.js';
import { impostazioni } from './views/impostazioni.js';

// nome del tool in alto a sinistra (si cambia solo qui)
const NOME = 'Bilancio';

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

const sezione = () => { const h = location.hash.slice(1).split('/')[0]; return VIEWS[h] ? h : 'dashboard'; };
export const sotto = () => location.hash.slice(1).split('/')[1] || '';
export const vai = k => { location.hash = k; };

function nav() {
  const cur = sezione(), nome = store.state.profilo.nome || store.email() || 'Tu';
  return `<nav class="nav">
    <div class="logo"><i></i>${NOME}</div>
    <div class="pills">${SEZIONI.map(([k, t]) => `<button data-go="${k}" class="${k === cur ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="right">
      <div class="per"><button class="chip" id="perbtn">${esc(etichetta(per))} ▾</button><div class="perpop" id="perpop" hidden></div></div>
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
  const app = $('#app'), k = sezione();
  app.innerHTML = nav() + '<main id="view"></main>';
  VIEWS[k]($('#view'), { s: store.state, per, setPer, render, vai, sotto: sotto() });
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => vai(b.dataset.go));
  $('#perbtn').onclick = e => { e.stopPropagation(); const pop = $('#perpop'); if (pop.hidden) openPop(); else pop.hidden = true; };
}
document.addEventListener('click', e => { const pop = $('#perpop'); if (pop && !pop.hidden && !e.target.closest('.per')) pop.hidden = true; });

function login() {
  $('#app').innerHTML = `<div class="login"><section class="card">
    <div class="logo"><i></i>${NOME}</div>
    <h1 style="font-size:1.6rem">Entra nel tuo bilancio</h1>
    <p class="kid">Ognuno vede solo i suoi soldi. Se è la prima volta, scrivi email e una password e premi <b>Crea account</b>.</p>
    <form class="form" id="lf">
      <label class="f">Email<input type="email" name="email" required autocomplete="email"></label>
      <label class="f">Password<input type="password" name="pw" required minlength="6" autocomplete="current-password"></label>
      <div class="btns"><button class="btn pri" type="submit">Entra</button><button class="btn" type="button" id="reg">Crea account</button></div>
      <p class="kid" id="lmsg"></p>
    </form></section></div>`;
  const f = $('#lf'), msg = $('#lmsg');
  const go = async reg => {
    const email = f.email.value.trim(), pw = f.pw.value;
    if (!email || pw.length < 6) { msg.textContent = 'Serve una email e una password di almeno 6 caratteri.'; return; }
    msg.textContent = 'Un attimo…';
    try {
      if (reg) { const d = await store.registrati(email, pw); if (!d.session) { msg.textContent = 'Account creato. Controlla la mail per confermarlo, poi entra.'; return; } }
      else await store.accedi(email, pw);
      await avvia();
    } catch (e) { msg.textContent = /invalid/i.test(e.message) ? 'Email o password sbagliate.' : e.message; }
  };
  f.onsubmit = e => { e.preventDefault(); go(false); };
  $('#reg').onclick = () => go(true);
}

async function avvia() {
  await store.carica();
  store.ascolta(ev => { if (ev !== 'saved') render(); else { const t = document.querySelector('[data-saving]'); if (t) t.textContent = store.saving; } });
  window.addEventListener('hashchange', render);
  render();
}

initTips();
(async () => {
  try {
    const ses = await store.sessione();
    if (!ses) login(); else await avvia();
  } catch (e) { console.error(e); $('#app').innerHTML = `<div class="login"><section class="card"><h3>Qualcosa non va</h3><p class="kid">${esc(e.message)}</p></section></div>`; }
})();
export { toast };
