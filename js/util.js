// Funzioni piccole usate ovunque: soldi, date, html sicuro, grafici morbidi.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const round2 = v => Math.round((+v || 0) * 100) / 100;

export const eur = (v, dec = 2) => (v < 0 ? '−' : '') + '€' + Math.abs(+v || 0).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const eur0 = v => eur(v, 0);
// numero grande con € piccolo e rialzato
export const big = (v, dec = 2) => `${v < 0 ? '−' : ''}<sup>€</sup>${Math.abs(+v || 0).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
export const pct = (v, dec = 0) => (v == null || !isFinite(v)) ? '—' : (v * 100).toLocaleString('it-IT', { maximumFractionDigits: dec }) + '%';

// ---------- date (stringhe YYYY-MM-DD, sempre ora locale) ----------
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const addMonths = (s, n) => { const d = parse(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d); };
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const monthStart = s => s.slice(0, 8) + '01';
export const monthEnd = s => { const d = parse(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
export const monthsBetween = (a, b) => { const A = parse(a), B = parse(b); return (B.getFullYear() - A.getFullYear()) * 12 + B.getMonth() - A.getMonth(); };

export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const MESI3 = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const dataBreve = s => { const d = parse(s); return `${d.getDate()} ${MESI3[d.getMonth()]}`; };
export const dataLunga = s => { const d = parse(s); return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`; };
export const meseAnno = s => { const d = parse(s); return `${MESI[d.getMonth()]} ${d.getFullYear()}`; };

// ---------- grafici ----------
// curva morbida (Catmull-Rom) con i punti di controllo bloccati tra i vicini: le linee cumulative non scendono mai
export function smooth(pts) {
  if (!pts.length) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = .18;
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]), cl = v => Math.max(lo, Math.min(hi, v));
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${cl(p1[1] + (p2[1] - p0[1]) * t)} ${p2[0] - (p3[0] - p1[0]) * t},${cl(p2[1] - (p3[1] - p1[1]) * t)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// tacche "belle" per un asse: 0 .. max
export function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// palette categorie: rampa magenta → viola → blu → ciano, ordine fisso
export const RAMP = [['#C04BE0', '#8E3BD6'], ['#A35BFF', '#6B3FD0'], ['#7B6BFF', '#5544D0'], ['#3BA0FF', '#1E5BD8'], ['#39C6E0', '#1F8FB0'], ['#5FD6C0', '#2E9C8A'], ['#E07BFF', '#B04BD0'], ['#8D8AA0', '#5A5770']];

let toastT;
export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600);
}

// tooltip generico: qualsiasi elemento con data-tip
export function initTips() {
  const tip = $('#tip');
  document.addEventListener('mousemove', e => {
    if (e.target.closest && e.target.closest('[data-owntip]')) return;
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.getAttribute('data-tip'); tip.hidden = false;
    tip.style.left = Math.min(e.clientX + 14, innerWidth - 260) + 'px'; tip.style.top = (e.clientY + 16) + 'px';
  });
}

export const icon = {
  line: '<svg viewBox="0 0 16 16"><path d="M2 12 L6 7 L9 9 L14 3" fill="none" stroke="#ECEAF2" stroke-width="1.6" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 16 16"><path d="M3 8h10M8 3v10" stroke="#ECEAF2" stroke-width="1.6" stroke-linecap="round"/></svg>',
  minus: '<svg viewBox="0 0 16 16"><path d="M3 8h10" stroke="#ECEAF2" stroke-width="1.6" stroke-linecap="round"/></svg>',
  flow: '<svg viewBox="0 0 16 16"><path d="M2 4 C8 4 8 12 14 12 M2 12 C8 12 8 4 14 4" fill="none" stroke="#ECEAF2" stroke-width="1.4"/></svg>',
  bars: '<svg viewBox="0 0 16 16"><path d="M3 4h10M3 8h7M3 12h4" stroke="#ECEAF2" stroke-width="1.6" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 16 16"><path d="M8 2 L13 4 V8 C13 11 8 14 8 14 C8 14 3 11 3 8 V4 Z" fill="none" stroke="#ECEAF2" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="#ECEAF2" stroke-width="1.4"/><path d="M8 5v3l2 1.5" fill="none" stroke="#ECEAF2" stroke-width="1.4" stroke-linecap="round"/></svg>',
  cash: '<svg viewBox="0 0 16 16"><rect x="2" y="4.5" width="12" height="7" rx="1.5" fill="none" stroke="#ECEAF2" stroke-width="1.4"/><circle cx="8" cy="8" r="1.6" fill="none" stroke="#ECEAF2" stroke-width="1.4"/></svg>',
  flag: '<svg viewBox="0 0 16 16"><path d="M4 14V2.5M4 3h8l-2 3 2 3H4" fill="none" stroke="#ECEAF2" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  tax: '<svg viewBox="0 0 16 16"><path d="M4 12 L12 4" stroke="#ECEAF2" stroke-width="1.5" stroke-linecap="round"/><circle cx="5" cy="5" r="1.6" fill="none" stroke="#ECEAF2" stroke-width="1.4"/><circle cx="11" cy="11" r="1.6" fill="none" stroke="#ECEAF2" stroke-width="1.4"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
};

export const card = (title, ic, body, extra = '', cls = '') =>
  `<section class="card ${cls}"><div class="ch">${ic ? `<span class="ic">${ic}</span>` : ''}<h3>${title}</h3>${extra}</div>${body}</section>`;
