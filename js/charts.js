// Grafici SVG fatti a mano, nello stile approvato. Ogni funzione restituisce markup o disegna dentro un <svg>.
import { smooth, eur, eur0, niceMax, RAMP, esc, uid } from './util.js';

// gauge semicircolare (0..1)
export function gauge(p, label) {
  const cx = 120, cy = 118, r = 92, q = Math.max(0, Math.min(1, p || 0)), id = 'gg' + uid();
  const pt = (a, rr) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
  const over = (p || 0) > 1;
  let s = `<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#4ADE9B"/><stop offset="1" stop-color="${over ? '#FF6B7A' : '#C6F06A'}"/></linearGradient></defs>`;
  for (let i = 0; i <= 30; i++) { const a = Math.PI - Math.PI * i / 30, [x1, y1] = pt(a, r + 10), [x2, y2] = pt(a, r + (i % 5 === 0 ? 18 : 14)); s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(200,230,180,.35)" stroke-width="1.2"/>`; }
  const [sx, sy] = pt(Math.PI, r), [ex, ey] = pt(0, r), a1 = Math.PI - Math.PI * q, [kx, ky] = pt(a1, r);
  s += `<path d="M${sx},${sy} A${r},${r} 0 0 1 ${ex},${ey}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="12" stroke-linecap="round"/>`;
  if (q > 0) s += `<path d="M${sx},${sy} A${r},${r} 0 0 1 ${kx},${ky}" fill="none" stroke="url(#${id})" stroke-width="12" stroke-linecap="round"/>`;
  s += `<circle cx="${kx}" cy="${ky}" r="9" fill="#F2F1F6" stroke="#121A14" stroke-width="3"/>`;
  s += `<text x="${cx}" y="${cy - 40}" text-anchor="middle" font-size="22" font-weight="700" fill="#ECEAF2">${label ?? Math.round((p || 0) * 100) + '%'}</text>`;
  return `<svg viewBox="0 0 240 130">${s}</svg>`;
}

export const segs = (p, n = 24) => { const on = Math.round(Math.max(0, Math.min(1, p || 0)) * n); return `<div class="segs">${Array.from({ length: n }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div>`; };

// barra spessa con gradiente e resto a righine
export const pbar = (p, g = 'linear-gradient(90deg,#1E5BD8,#3BA0FF)', h = 30) =>
  `<div class="pbar" style="height:${h}px">${p > 0 ? `<div class="f" style="width:${Math.min(100, p * 100)}%;background:${g}"></div>` : ''}<div class="rest"></div></div>`;
export const minibar = (p, g, mark) =>
  `<div class="minibar">${p > 0 ? `<div class="f" style="width:${Math.min(100, p * 100)}%;background:${g}"></div>` : ''}<div class="rest"></div>${mark != null ? `<i class="mark" style="left:${Math.min(100, mark * 100)}%"></i>` : ''}</div>`;

// anello
export function ring(p, txt) {
  const r = 46, C = 2 * Math.PI * r, q = Math.max(0, Math.min(1, p || 0)), id = 'rg' + uid();
  let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9EC9FF"/><stop offset="1" stop-color="#2F6BFF"/></linearGradient></defs>`;
  for (let i = 0; i < 60; i++) { const a = i / 60 * 2 * Math.PI; s += `<circle cx="${60 + 56 * Math.cos(a)}" cy="${60 + 56 * Math.sin(a)}" r="1" fill="rgba(255,255,255,.18)"/>`; }
  s += `<circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="12"/>`;
  s += `<circle cx="60" cy="60" r="${r}" fill="none" stroke="url(#${id})" stroke-width="12" stroke-linecap="round" stroke-dasharray="${Math.max(C * q, 0.1)} ${C}" transform="rotate(-90 60 60)"/>`;
  s += `<text x="60" y="66" text-anchor="middle" font-size="18" font-weight="700" fill="#ECEAF2">${txt ?? Math.round(q * 100) + '%'}</text>`;
  return `<svg viewBox="0 0 120 120">${s}</svg>`;
}

// righello con cursore arancio
export function ruler(v, max) {
  const W = 260, mx = niceMax(Math.max(max, v, 1)), x = q => 10 + (W - 20) * q / mx; let s = '';
  const step = mx / 30;
  for (let i = 0; i <= 30; i++) { const q = i * step, major = i % 5 === 0; s += `<line x1="${x(q)}" x2="${x(q)}" y1="${major ? 6 : 12}" y2="34" stroke="rgba(255,255,255,${major ? .45 : .2})" stroke-width="1.2"/>`; if (major) s += `<text x="${x(q)}" y="52" text-anchor="middle" font-size="11" fill="#6F6C80">€${Math.round(q)}</text>`; }
  s += `<line x1="${x(Math.min(v, mx))}" x2="${x(Math.min(v, mx))}" y1="0" y2="38" stroke="#FF7A3D" stroke-width="2.5" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 260 60">${s}</svg>`;
}

// sparkline luminosa
export function spark(vals, labels) {
  const W = 260, H = 110, t = 12, b = 8, n = vals.length, max = niceMax(Math.max(...vals, 1)), id = uid();
  if (n < 2) return `<svg viewBox="0 0 ${W} ${H}"></svg>`;
  const X = i => 6 + (W - 12) * i / (n - 1), Y = y => t + (H - t - b) * (1 - Math.max(0, y) / max);
  const pts = vals.map((y, i) => [X(i), Y(y)]), d = smooth(pts);
  let s = `<defs><linearGradient id="sg${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C04BE0" stop-opacity=".45"/><stop offset="1" stop-color="#C04BE0" stop-opacity="0"/></linearGradient><filter id="gl${id}"><feGaussianBlur stdDeviation="3"/></filter></defs>`;
  s += `<path d="${d} L${X(n - 1)},${H} L${X(0)},${H} Z" fill="url(#sg${id})"/><path d="${d}" fill="none" stroke="#E07BFF" stroke-width="4" opacity=".5" filter="url(#gl${id})"/><path d="${d}" fill="none" stroke="#E07BFF" stroke-width="2"/>`;
  s += `<circle cx="${X(n - 1)}" cy="${Y(vals[n - 1])}" r="5" fill="#fff"/>`;
  pts.forEach((p, i) => s += `<rect x="${p[0] - 14}" y="0" width="28" height="${H}" fill="transparent" data-tip="${esc(labels[i])}: ${eur(vals[i])}"/>`);
  return `<svg viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

// barre categorie
export function cats(list, tot) {
  if (!list.length) return '<p class="empty">Nessuna spesa in questo periodo.</p>';
  const max = Math.max(...list.map(x => x[1]), 1);
  return `<div class="cats">${list.map(([n, v], i) => { const [c1, c2] = RAMP[Math.min(i, RAMP.length - 1)];
    return `<div class="cat" data-tip="${esc(n)}: ${eur(v)} · ${Math.round(v / (tot || 1) * 100)}% delle spese"><span>${esc(n)}</span><span class="tr"><span class="f" style="width:${Math.max(0, v) / max * 100}%;background:linear-gradient(90deg,${c2},${c1})"></span><span class="rest"></span></span><span class="v n">${eur(v)}</span></div>`; }).join('')}</div>`;
}

// linee nel tempo con hover: serie [{nome, colore, valori, area?, tratteggio?}], etichette asse x
export function lines(svg, { series, labels, tipLabel, W = 820, H = 300, fmt = eur, ticks }) {
  const l = 56, r = 16, t = 16, b = 30, iw = W - l - r, ih = H - t - b, n = labels.length;
  const all = series.flatMap(s => s.valori.filter(v => v != null));
  const lo = Math.min(0, ...all), hiRaw = Math.max(...all, 1), hi = niceMax(hiRaw), lo2 = lo < 0 ? -niceMax(-lo) : 0;
  const X = i => l + iw * (n <= 1 ? .5 : i / (n - 1)), Y = v => t + ih - ih * (v - lo2) / (hi - lo2);
  const id = uid();
  let s = `<defs><pattern id="h${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#C04BE0" stroke-width="1.4"/></pattern>
    <linearGradient id="f${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="m${id}"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#f${id})"/></mask>
    <linearGradient id="la${id}" x1="0" x2="1"><stop offset="0" stop-color="#8E5BFF"/><stop offset="1" stop-color="#E07BFF"/></linearGradient></defs>`;
  const steps = 5;
  for (let k = 0; k <= steps; k++) { const v = lo2 + (hi - lo2) * k / steps; s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,${v === 0 && lo2 < 0 ? .18 : .05})"/><text x="${l - 10}" y="${Y(v) + 4}" text-anchor="end" font-size="12" fill="#6F6C80">${Math.round(v).toLocaleString('it-IT')}</text>`; }
  const tk = ticks || (n <= 8 ? labels.map((_, i) => i) : [0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round(3 * (n - 1) / 4), n - 1]);
  tk.forEach(i => s += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="12" fill="#6F6C80">${esc(labels[i])}</text>`);
  series.forEach(se => {
    const pts = se.valori.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
    if (!pts.length) return;
    const first = se.valori.findIndex(v => v != null);
    const d = smooth(pts);
    if (se.area) s += `<path d="${d} L${pts[pts.length - 1][0]},${Y(Math.max(0, lo2))} L${X(first)},${Y(Math.max(0, lo2))} Z" fill="url(#h${id})" mask="url(#m${id})"/>`;
    s += `<path d="${d}" fill="none" stroke="${se.area ? `url(#la${id})` : se.colore}" stroke-width="${se.area ? 3 : 2.4}" ${se.tratteggio ? 'stroke-dasharray="6 6"' : ''}/>`;
  });
  s += `<g class="hov" opacity="0"><line class="hl" y1="${t}" y2="${t + ih}" stroke="rgba(255,255,255,.4)" stroke-dasharray="4 5"/>${series.map((se, k) => `<circle class="hc${k}" r="${k ? 5 : 6}" fill="${se.punto || se.colore}" stroke="#17161F" stroke-width="3"/>`).join('')}</g>`;
  s += `<rect class="hit" x="${l}" y="${t}" width="${iw}" height="${ih}" fill="transparent"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('data-owntip', '1'); svg.innerHTML = s;
  const tip = document.getElementById('tip'), hov = svg.querySelector('.hov');
  svg.onmousemove = e => {
    const bb = svg.getBoundingClientRect(), x = (e.clientX - bb.left) / bb.width * W, i = Math.max(0, Math.min(n - 1, Math.round((x - l) / iw * (n - 1))));
    hov.setAttribute('opacity', 1); const hl = svg.querySelector('.hl'); hl.setAttribute('x1', X(i)); hl.setAttribute('x2', X(i));
    series.forEach((se, k) => { const c = svg.querySelector('.hc' + k), v = se.valori[i]; if (v == null) c.setAttribute('opacity', 0); else { c.setAttribute('opacity', 1); c.setAttribute('cx', X(i)); c.setAttribute('cy', Y(v)); } });
    tip.textContent = `${tipLabel ? tipLabel(i) : labels[i]}\n` + series.filter(se => se.valori[i] != null).map(se => `${se.nome}: ${fmt(se.valori[i])}`).join('\n');
    tip.hidden = false; tip.style.left = Math.min(e.clientX + 16, innerWidth - 220) + 'px'; tip.style.top = (e.clientY - 70) + 'px';
  };
  svg.onmouseleave = () => { hov.setAttribute('opacity', 0); tip.hidden = true; };
}

// flusso (sankey) da fonti a categorie
export function flow(ins, outs) {
  const tot = outs.reduce((a, x) => a + x[1], 0), totIn = ins.reduce((a, x) => a + x[1], 0);
  if (tot <= 0 || totIn <= 0) return '<p class="empty">Niente da mostrare in questo periodo.</p>';
  const W = 760, T = 10, gap = 8, Lx = 170, Rx = 500, NW = 10;
  const H = Math.max(240, outs.length * 40 + 20);
  const scR = (H - 2 * T - gap * (outs.length - 1)) / tot, scL = (H - 2 * T - gap * (ins.length - 1)) / totIn;
  let y = T; const L = ins.map(([n, v, c]) => { const o = { n, v, c, y, h: v * scL, used: 0 }; y += o.h + gap; return o; });
  const id = uid(); let defs = '<defs>', s = '', ry = T, k = 0; const labs = [];
  outs.forEach(([n, v], oi) => {
    const c1 = n === 'Messo da parte' ? '#4ADE9B' : RAMP[Math.min(oi, RAMP.length - 1)][0];
    const hh = v * scR; let off = 0;
    L.forEach(lo => { const share = v * lo.v / totIn, lh = share * scL, rh = share * scR, y0 = lo.y + lo.used, y1 = ry + off, m = (Lx + Rx) / 2, gid = 'fg' + id + (k++);
      defs += `<linearGradient id="${gid}" x1="0" x2="1"><stop offset="0" stop-color="${lo.c}" stop-opacity=".45"/><stop offset="1" stop-color="${c1}" stop-opacity=".55"/></linearGradient>`;
      s += `<path d="M${Lx + NW},${y0}C${m},${y0} ${m},${y1} ${Rx},${y1}L${Rx},${y1 + rh}C${m},${y1 + rh} ${m},${y0 + lh} ${Lx + NW},${y0 + lh}Z" fill="url(#${gid})" data-tip="${esc(lo.n)} → ${esc(n)}: ${eur(share)}"/>`; lo.used += lh; off += rh; });
    s += `<rect x="${Rx}" y="${ry}" width="${NW}" height="${Math.max(hh, 2)}" rx="4" fill="${c1}"/>`;
    labs.push({ y: ry + hh / 2 + 5, t: `<tspan>${esc(n)}</tspan> <tspan fill="#A9A6B8" font-weight="500">${eur(v)}</tspan>` });
    ry += hh + gap;
  });
  // etichette a destra: mai sovrapposte (minimo 18px tra una e l'altra)
  for (let i = 1; i < labs.length; i++) labs[i].y = Math.max(labs[i].y, labs[i - 1].y + 18);
  const over = labs.length ? labs[labs.length - 1].y - (H - 4) : 0;
  if (over > 0) { labs[labs.length - 1].y -= over; for (let i = labs.length - 2; i >= 0; i--) labs[i].y = Math.min(labs[i].y, labs[i + 1].y - 18); }
  labs.forEach(l => s += `<text x="${Rx + NW + 12}" y="${l.y}" font-size="14" font-weight="600" fill="#ECEAF2">${l.t}</text>`);
  L.forEach(lo => { s += `<rect x="${Lx}" y="${lo.y}" width="${NW}" height="${Math.max(lo.h, 2)}" rx="4" fill="${lo.c}"/><text x="${Lx - 14}" y="${lo.y + lo.h / 2}" text-anchor="end" font-size="14" font-weight="600" fill="#ECEAF2">${esc(lo.n)}</text><text x="${Lx - 14}" y="${lo.y + lo.h / 2 + 18}" text-anchor="end" font-size="13" fill="#A9A6B8">${eur(lo.v)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}">${defs}</defs>${s}</svg>`;
}

// colonne mese per mese (entrate vs spese), asse unico, cifre sopra le barre e saldo sotto ogni mese
export function columns(rows, { W = 820, H = 300, etichette = true } = {}) {
  const l = 46, r = 10, t = 22, b = 58, iw = W - l - r, ih = H - t - b, n = rows.length, id = uid();
  const max = niceMax(Math.max(1, ...rows.flatMap(x => [x.a, x.b])));
  const bw = iw / Math.max(n, 1), cw = Math.min(30, bw * .34), Y = v => t + ih - ih * Math.max(0, v) / max;
  let s = '';
  for (let k = 0; k <= 4; k++) { const v = max * k / 4; s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,${k ? .05 : .15})"/><text x="${l - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#6F6C80">${corto(v)}</text>`; }
  rows.forEach((x, i) => {
    const cx = l + bw * i + bw / 2, sal = x.a - x.b;
    s += `<g class="colg" data-tip="${esc(x.label)}\nEntrate: ${eur(x.a)}\nSpese: ${eur(x.b)}\nTi è rimasto: ${eur(sal)}"><rect class="band" x="${l + bw * i + 2}" y="${t - 18}" width="${bw - 4}" height="${ih + 18 + b - 6}" rx="12" fill="transparent"/>`;
    s += `<rect x="${cx - cw - 2}" y="${Y(x.a)}" width="${cw}" height="${Math.max(0, t + ih - Y(x.a))}" rx="7" fill="url(#cA${id})"/>`;
    s += `<rect x="${cx + 2}" y="${Y(x.b)}" width="${cw}" height="${Math.max(0, t + ih - Y(x.b))}" rx="7" fill="url(#cB${id})"/>`;
    if (etichette) {
      if (x.a) s += `<text x="${cx - cw / 2 - 2}" y="${Y(x.a) - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#8CC4FF">${corto(x.a)}</text>`;
      if (x.b) s += `<text x="${cx + cw / 2 + 2}" y="${Y(x.b) - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#E3A6F5">${corto(x.b)}</text>`;
    }
    s += `<text x="${cx}" y="${t + ih + 18}" text-anchor="middle" font-size="12" font-weight="600" fill="#A9A6B8">${esc(x.short)}</text>`;
    const pw = Math.min(bw - 6, 58);
    s += `<rect x="${cx - pw / 2}" y="${t + ih + 28}" width="${pw}" height="20" rx="10" fill="${sal >= 0 ? 'rgba(74,222,155,.14)' : 'rgba(255,107,122,.14)'}"/><text x="${cx}" y="${t + ih + 42}" text-anchor="middle" font-size="11" font-weight="800" fill="${sal >= 0 ? '#4ADE9B' : '#FF6B7A'}">${sal >= 0 ? '+' : ''}${corto(sal)}</text></g>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="cols"><defs><linearGradient id="cA${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3BA0FF"/><stop offset="1" stop-color="#1E5BD8"/></linearGradient><linearGradient id="cB${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C04BE0"/><stop offset="1" stop-color="#6B2FBF"/></linearGradient></defs>${s}</svg>`;
}

// numeri corti per le etichette sopra le barre: 850, 1,2k, −3,1k
export const corto = v => { const a = Math.abs(v), s = v < 0 ? '−' : ''; return a >= 1000 ? s + (a / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + 'k' : s + Math.round(a); };

// pacing a barre: mesi passati pieni, mese di oggi illuminato, mesi futuri a righe (previsione), linea dell'obiettivo
// mesi: [{ label, v, tipo: 'passato'|'oggi'|'futuro', tip }]
export function barrePacing(mesi, { target = 0, W = 820, H = 280 } = {}) {
  const l = 14, r = 14, t = 26, b = 34, iw = W - l - r, ih = H - t - b, n = mesi.length, id = uid();
  const vals = mesi.map(m => m.v).concat(target ? [target] : []);
  const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals), span = (hi - lo) || 1;
  const ihp = ih - (lo < 0 ? 22 : 0); // spazio per le cifre sotto le barre negative
  const Y = v => t + ihp * (hi - v) / span, y0 = Y(0);
  const bw = iw / n, w = Math.min(46, bw * .62);
  let s = `<defs>
    <linearGradient id="pp${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C04BE0"/><stop offset="1" stop-color="#6B3FD0"/></linearGradient>
    <linearGradient id="pn${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF7A3D"/><stop offset="1" stop-color="#D9304A"/></linearGradient>
    <linearGradient id="po${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0A8FF"/><stop offset="1" stop-color="#C04BE0"/></linearGradient>
    <pattern id="pf${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="rgba(59,160,255,.08)"/><line x1="0" y1="0" x2="0" y2="7" stroke="#3BA0FF" stroke-width="2" stroke-opacity=".55"/></pattern>
    <filter id="pg${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter></defs>`;
  s += `<line x1="${l}" x2="${W - r}" y1="${y0}" y2="${y0}" stroke="rgba(255,255,255,.18)"/>`;
  mesi.forEach((m, i) => {
    const cx = l + bw * i + bw / 2, x = cx - w / 2, yv = Y(m.v), top = Math.min(yv, y0), h = Math.max(2, Math.abs(y0 - yv));
    const fut = m.tipo === 'futuro', now = m.tipo === 'oggi';
    const fill = fut ? `url(#pf${id})` : m.v < 0 ? `url(#pn${id})` : now ? `url(#po${id})` : `url(#pp${id})`;
    s += `<g data-tip="${esc(m.tip)}"><rect x="${l + bw * i}" y="${t - 20}" width="${bw}" height="${ih + 40}" fill="transparent"/>`;
    if (now) s += `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="8" fill="#E07BFF" opacity=".55" filter="url(#pg${id})"/>`;
    s += `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="8" fill="${fill}" ${fut ? 'stroke="#3BA0FF" stroke-width="1.5" stroke-dasharray="4 3"' : ''}/>`;
    const ly = m.v >= 0 ? top - 7 : top + h + 15;
    s += `<text x="${cx}" y="${ly}" text-anchor="middle" font-size="${now ? 14 : 12}" font-weight="${now ? 800 : 600}" fill="${fut ? '#8CC4FF' : now ? '#fff' : '#A9A6B8'}">${corto(m.v)}</text></g>`;
    s += `<text x="${cx}" y="${H - 14}" text-anchor="middle" font-size="12" font-weight="${now ? 800 : 500}" fill="${now ? '#ECEAF2' : '#6F6C80'}">${esc(m.label)}</text>`;
    if (now) s += `<text x="${cx}" y="${H - 1}" text-anchor="middle" font-size="10" font-weight="700" fill="#E07BFF">OGGI</text>`;
  });
  if (target) {
    const ty = Y(target);
    s += `<line x1="${l}" x2="${W - r}" y1="${ty}" y2="${ty}" stroke="#FF7A3D" stroke-width="2" stroke-dasharray="7 6"/>`;
    s += `<rect x="${l}" y="${ty - 22}" width="128" height="18" rx="9" fill="rgba(255,122,61,.22)"/><text x="${l + 64}" y="${ty - 9}" text-anchor="middle" font-size="11" font-weight="700" fill="#FFB38F">obiettivo ${eur0(target)}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}">${s}</svg>`;
}
