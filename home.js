// Home dell'app: login, invito (crea la password), scelta dei moduli, porta d'ingresso a Ledger e Frame.
import { online, client, utente, esci } from './shared/supa.js';
import { documento } from './shared/sync.js';
import { NOME, MODULI } from './shared/brand.js';

// il link dell'invito (o di "password dimenticata") arriva con #type=invite / #type=recovery:
// lo leggo prima che Supabase lo consumi
const H = new URLSearchParams(location.hash.slice(1));
const daLink = H.get('type');                      // 'invite' | 'recovery' | 'magiclink' | null
const erroreLink = H.get('error_description');

const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
const installata = navigator.standalone || matchMedia('(display-mode: standalone)').matches;

const MARCHI = {
  ledger: '<i class="m-ledger"></i>',
  frame: '<svg class="m-frame" viewBox="0 0 32 32"><defs><linearGradient id="fg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#3BA0FF"/><stop offset="1" stop-color="#C04BE0"/></linearGradient></defs><path d="M8 19.6 C11.5 16.8 13.8 20.4 17.2 17.8 S22.6 12.6 24.6 13.2" fill="none" stroke="url(#fg)" stroke-width="3.6" stroke-linecap="round"/><path d="M3.6 19.4 C4.4 16.6 8.4 16.4 9.4 18.6 C10.2 20.6 8.6 23.4 6.2 23.2 C4.2 23 3.2 21.2 3.6 19.4 Z" fill="url(#fg)"/><path d="M22.4 12.4 C23.2 9.6 27.6 9 28.8 11.2 C29.6 12.8 28.4 15 26 15.2 C23.6 15.4 22 14.2 22.4 12.4 Z" fill="url(#fg)"/></svg>',
};
const logo = () => `<div class="brand"><img src="/icone/icona-192.png" alt="" width="34" height="34"><span>${esc(NOME)}</span></div>`;

function schermo(html) { app.innerHTML = html; window.scrollTo(0, 0); }
function messaggio(el, testo, tipo = '') { el.textContent = testo; el.className = 'msg ' + tipo; }

// ---------- login ----------
function login(avviso = '') {
  schermo(`<section class="box">
    ${logo()}
    <h1>Entra</h1>
    <p class="sub">Si entra solo su invito. Usa l'email dell'invito e la password che hai scelto.</p>
    ${avviso ? `<p class="msg err">${esc(avviso)}</p>` : ''}
    <form id="f" class="form">
      <label>Email<input id="email" type="email" required autocomplete="username" inputmode="email"></label>
      <label>Password<input id="pw" type="password" required autocomplete="current-password"></label>
      <button class="btn pri" type="submit">Entra</button>
      <button class="link" type="button" id="dim">Password dimenticata?</button>
      <p class="msg" id="msg"></p>
    </form>
  </section>`);
  const msg = $('#msg');
  $('#f').onsubmit = async e => {
    e.preventDefault();
    messaggio(msg, 'Un attimo…');
    const c = await client();
    const { error } = await c.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#pw').value });
    if (error) return messaggio(msg, /invalid/i.test(error.message) ? 'Email o password sbagliate.' : error.message, 'err');
    avvia();
  };
  $('#dim').onclick = async () => {
    const email = $('#email').value.trim();
    if (!email) return messaggio(msg, 'Scrivi prima la tua email, poi tocca di nuovo "Password dimenticata?".', 'err');
    const c = await client();
    const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
    messaggio(msg, error ? error.message : 'Ti ho mandato una mail: tocca il link e scegli la nuova password.', error ? 'err' : 'ok');
  };
}

// ---------- crea la password (dal link dell'invito o di recupero) ----------
function creaPassword(user, nuovo) {
  return new Promise(fine => {
    schermo(`<section class="box">
      ${logo()}
      <h1>${nuovo ? 'Benvenuto' : 'Nuova password'}</h1>
      <p class="sub">${nuovo ? 'Scegli la password con cui entrerai.' : 'Scegli la nuova password.'} Account: <b>${esc(user.email)}</b></p>
      <form id="f" class="form">
        ${nuovo ? '<label>Come ti chiami?<input id="nome" autocomplete="given-name" required></label>' : ''}
        <input type="email" value="${esc(user.email)}" autocomplete="username" hidden>
        <label>Password<input id="pw" type="password" minlength="8" required autocomplete="new-password"></label>
        <label>Ripeti la password<input id="pw2" type="password" minlength="8" required autocomplete="new-password"></label>
        <button class="btn pri" type="submit">Salva ed entra</button>
        <p class="msg" id="msg"></p>
      </form>
    </section>`);
    const msg = $('#msg');
    $('#f').onsubmit = async e => {
      e.preventDefault();
      const pw = $('#pw').value;
      if (pw.length < 8) return messaggio(msg, 'Almeno 8 caratteri.', 'err');
      if (pw !== $('#pw2').value) return messaggio(msg, 'Le due password non sono uguali.', 'err');
      messaggio(msg, 'Un attimo…');
      const c = await client();
      const { error } = await c.auth.updateUser({ password: pw });
      if (error) return messaggio(msg, error.message, 'err');
      fine(nuovo ? $('#nome').value.trim() : null);
    };
  });
}

// ---------- scelta dei moduli ----------
function sceltaModuli(profilo, salva, primaVolta) {
  return new Promise(fine => {
    const scelti = new Set(profilo.moduli || MODULI.map(m => m.id));
    const disegna = () => {
      schermo(`<section class="box">
      ${logo()}
      <h1>Cosa usi?</h1>
      <p class="sub">Accendi solo quello che ti serve. Puoi cambiarlo quando vuoi.</p>
      <div class="mods">${MODULI.map(m => `<button class="mod ${scelti.has(m.id) ? 'on' : ''}" data-m="${m.id}" aria-pressed="${scelti.has(m.id)}">
        <span class="mk">${MARCHI[m.id]}</span><span class="tx"><b>${m.nome}</b><small>${m.cosa}</small></span><span class="sw"></span></button>`).join('')}</div>
      <button class="btn pri" id="ok" ${scelti.size ? '' : 'disabled'}>${primaVolta ? 'Continua' : 'Salva'}</button>
      ${primaVolta ? '' : '<button class="link" id="no">Annulla</button>'}
    </section>`);
      bind();
    };
    const bind = () => {
      app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const id = b.dataset.m; scelti.has(id) ? scelti.delete(id) : scelti.add(id); disegna(); });
      $('#ok').onclick = () => { salva({ ...profilo, moduli: MODULI.map(m => m.id).filter(id => scelti.has(id)) }); fine(); };
      $('#no')?.addEventListener('click', fine);
    };
    disegna();
  });
}

// ---------- Home ----------
function home(user, profilo, doc) {
  const nome = profilo.nome || user?.email?.split('@')[0] || '';
  const miei = MODULI.filter(m => !profilo.moduli || profilo.moduli.includes(m.id));
  const ora = new Date().getHours();
  const saluto = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Ciao' : 'Buonasera';
  schermo(`<header class="top">${logo()}<button class="chip" id="menu" aria-haspopup="true">${esc((nome || '?').charAt(0).toUpperCase())}</button></header>
    <section class="hello"><h1>${saluto}${nome ? ', ' + esc(nome) : ''}</h1>${online ? '' : '<p class="sub">Modalità demo: niente login, i dati restano su questo dispositivo.</p>'}</section>
    ${iphone && !installata ? `<section class="hint"><b>Mettila sulla schermata Home</b><span>Tocca <span class="share" aria-label="Condividi"></span> in basso, poi <b>Aggiungi alla schermata Home</b>. Aprendola dall'icona rifai il login una volta sola.</span></section>` : ''}
    <section class="tiles">${miei.map(m => `<a class="tile t-${m.id}" href="${m.url}"><span class="mk">${MARCHI[m.id]}</span><span class="tx"><b>${m.nome}</b><small>${m.cosa}</small></span><span class="go">›</span></a>`).join('') || '<p class="sub">Nessun modulo acceso. Aprili dal menu in alto.</p>'}</section>
    <div class="sheet" id="sheet" hidden>
      ${user ? `<p class="sub">Account: <b>${esc(user.email)}</b></p>` : ''}
      <button class="btn" id="mods">Scegli i moduli</button>
      ${online && miei.some(m => m.id === 'ledger') ? '<a class="btn" href="/banca/" style="color:inherit;text-decoration:none">Banca (Revolut)</a>' : ''}
      ${online ? '<button class="btn ghost" id="out">Esci</button>' : ''}
    </div>`);
  $('#menu').onclick = () => { const s = $('#sheet'); s.hidden = !s.hidden; };
  $('#mods').onclick = async () => { await sceltaModuli(profilo, p => { Object.assign(profilo, p); doc?.salva(profilo); }, false); home(user, profilo, doc); };
  $('#out')?.addEventListener('click', esci);
}

// ---------- avvio ----------
async function avvia() {
  if (!online) {
    let p = {}; try { p = JSON.parse(localStorage.getItem('demo-profilo')) || {}; } catch {}
    return home(null, p, { salva: x => { try { localStorage.setItem('demo-profilo', JSON.stringify(x)); } catch {} } });
  }
  if (erroreLink) { history.replaceState(null, '', '/'); return login(/expired|scadut/i.test(erroreLink) ? 'Il link è scaduto o è già stato usato. Chiedi a Simone un nuovo invito, oppure usa "Password dimenticata?".' : erroreLink); }
  const user = await utente();
  if (!user) return login();

  const doc = documento(user.id, 'profilo');
  const profilo = (await doc.carica()) || {};
  if (daLink === 'invite' || daLink === 'recovery') {
    const nome = await creaPassword(user, daLink === 'invite');
    if (nome) profilo.nome = nome;
    history.replaceState(null, '', '/');
  }
  if (!profilo.moduli) await sceltaModuli(profilo, p => Object.assign(profilo, p), true);
  doc.salva(profilo);
  doc.quandoCambia(p => { Object.assign(profilo, p); home(user, profilo, doc); });
  home(user, profilo, doc);
}

avvia().catch(e => { console.error(e); schermo(`<section class="box">${logo()}<h1>Qualcosa non va</h1><p class="msg err">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Riprova</button></section>`); });
