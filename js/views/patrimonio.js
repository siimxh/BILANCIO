// Patrimonio: quanto vali in soldi oggi, come si muove, dove arrivi.
import { $, esc, eur, eur0, big, icon, card, today, dataLunga, MESI3, parse, uid, round2, toast, pct } from '../util.js';
import * as E from '../engine.js';
import * as C from '../charts.js';
import { modifica } from '../store.js';
import { paceChart } from './dashboard.js';
import { apri, chiudi } from './forms.js';

export function patrimonio(root, { s }) {
  const oggi = today(), P = E.pacing(s, oggi), now = E.patrimonio(s, oggi);
  const inizioAnno = oggi.slice(0, 4) + '-01-01';
  const pa = E.patrimonio(s, E.primaData(s) > inizioAnno ? E.primaData(s) : inizioAnno);
  const varAnno = now.netto - pa.netto;
  const voci = [
    ['Soldi sui conti e contanti', now.liquidi, 'linear-gradient(90deg,#1E5BD8,#3BA0FF)'],
    ['Investimenti', now.investimenti, 'linear-gradient(90deg,#6B3FD0,#A35BFF)'],
    ['Beni (auto, oggetti di valore)', now.beni, 'linear-gradient(90deg,#1F8FB0,#39C6E0)'],
    ['Debiti', -now.debiti, 'linear-gradient(90deg,#D9502A,#FF7A3D)'],
    ['Tasse ancora da pagare', -now.tasse, 'linear-gradient(90deg,#D9304A,#FF6B7A)'],
  ];
  const maxV = Math.max(1, ...voci.map(v => Math.abs(v[1])));

  root.innerHTML = `
  <div class="hello"><div><h1>Patrimonio</h1><p>Tutto quello che hai, meno tutto quello che devi.</p></div></div>
  <div class="g">
    <section class="card s4 c-saldo">
      <div class="top"><span>PATRIMONIO NETTO</span><span>oggi</span></div>
      <div class="big n">${big(now.netto)}</div>
      <span class="sub" style="color:#C9D6F2">${varAnno >= 0 ? '+' : ''}${eur(varAnno)} da inizio anno</span>
    </section>
    <section class="card s8">
      <div class="ch"><span class="ic">${icon.bars}</span><h3>Di cosa è fatto</h3></div>
      <div class="cats">${voci.map(([n, v, g]) => `<div class="cat"><span>${n}</span><span class="tr"><span class="f" style="width:${Math.abs(v) / maxV * 100}%;background:${g}"></span><span class="rest"></span></span><span class="v n ${v < 0 ? 'neg' : ''}">${eur(v)}</span></div>`).join('')}</div>
    </section>

    <section class="card s12">
      <div class="ch"><span class="ic">${icon.line}</span><h3>Pacing: dove arrivi a questo ritmo</h3></div>
      <div class="lg"><span><i style="background:var(--mag)"></i>Patrimonio netto</span><span><i style="background:var(--cyan)"></i>Previsione</span>${P.target ? '<span><i style="background:#FF7A3D"></i>Obiettivo fine anno</span>' : ''}</div>
      <svg id="pace2" aria-label="Patrimonio e previsione"></svg>
      <div class="g" style="gap:12px">${P.uniti.map(t => `<div class="s${12 / P.uniti.length}" style="background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:grid;gap:6px">
        <span class="k">${esc(t.etichetta)}</span><span class="mid n">${big(t.stima, 0)}</span>
        <span class="sub">${t.mesi < .05 ? 'periodo finito' : `tra ${t.mesi.toLocaleString('it-IT', { maximumFractionDigits: 1 })} mesi · ${t.stima - P.ora >= 0 ? '+' : ''}${eur0(t.stima - P.ora)}`}</span>
        ${P.target && t.modi.includes('anno') ? `<span class="st ${t.stima >= P.target ? 'ok' : 'warn'}">${t.stima >= P.target ? `Ci arrivi (obiettivo ${eur0(P.target)})` : `Mancano ${eur0(P.target - t.stima)} all'obiettivo`}</span>` : ''}
      </div>`).join('')}</div>
      <p class="kid">Come lo calcolo: prendo quanto è cambiato il patrimonio negli ultimi ${P.N} mesi (in media <b class="n">${P.media >= 0 ? '+' : ''}${eur(P.media)}</b> al mese) e lo porto avanti. ${P.target ? (() => { const t = P.traguardi[2], mesi = Math.max(.5, t.mesi), serve = (P.target - P.ora) / mesi; return serve > 0 ? `Per arrivare a ${eur0(P.target)} a fine anno ti servono <b class="n">${eur0(serve)}</b> in più al mese.` : 'Hai già superato l\'obiettivo di fine anno.'; })() : 'Puoi fissare un obiettivo di fine anno nelle Impostazioni.'}</p>
    </section>

    <section class="card s6" style="grid-column:span 6">
      <div class="ch"><span class="ic">${icon.cash}</span><h3>Conti</h3><span class="go" data-go="impostazioni" style="cursor:pointer">↗</span></div>
      <div class="list">${now.conti.map(c => `<div class="item"><div><h4>${esc(c.nome)}</h4><span class="meta">${esc({ banca: 'Conto', contanti: 'Portafoglio', risparmio: 'Salvadanaio', tasse: 'Salvadanaio tasse', investimento: 'Investimenti' }[c.tipo])}</span></div><span class="mid n" style="font-size:1.15rem">${eur(c.saldo)}</span></div>`).join('')}</div>
    </section>
    <section class="card s6" style="grid-column:span 6">
      <div class="ch"><span class="ic">${icon.flag}</span><h3>Beni</h3><button class="btn sm" style="margin-left:auto" data-a="bene">＋ Aggiungi</button></div>
      <p class="kid">Cose che valgono soldi e potresti rivendere: auto, scooter, orologio, PC. Metti il valore di oggi, non quello pagato.</p>
      <div class="list">${s.beni.map(b => `<div class="item" data-bene="${b.id}" style="cursor:pointer"><div><h4>${esc(b.nome)}</h4></div><span class="mid n" style="font-size:1.15rem">${eur(b.valore)}</span></div>`).join('') || '<p class="empty">Nessun bene inserito.</p>'}</div>
    </section>
  </div>`;
  paceChart($('#pace2', root), P);
  root.querySelector('[data-a="bene"]').onclick = () => formBene();
  root.querySelectorAll('[data-bene]').forEach(el => el.onclick = () => formBene(s.beni.find(b => b.id === el.dataset.bene)));
  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => location.hash = b.dataset.go);
}

function formBene(b = null) {
  const nuovo = !b; b = b || { id: uid() };
  apri(nuovo ? 'Nuovo bene' : 'Modifica bene', `<form class="form" id="bf">
    <div class="fr"><label class="f">Cos'è<input name="nome" required value="${esc(b.nome || '')}"></label><label class="f">Quanto vale oggi (€)<input name="valore" type="number" step="1" min="0" required value="${b.valore ?? ''}"></label></div>
    <div class="btns"><button class="btn pri" type="submit">Salva</button>${nuovo ? '' : '<button class="btn danger" type="button" id="bdel">Elimina</button>'}</div></form>`, d => {
    const f = $('#bf', d);
    f.onsubmit = e => { e.preventDefault(); const out = { id: b.id, nome: f.nome.value.trim(), valore: round2(+f.valore.value) }; modifica(st => { const k = st.beni.findIndex(x => x.id === b.id); if (k >= 0) st.beni[k] = out; else st.beni.push(out); }); chiudi(); toast('Salvato'); };
    $('#bdel', d)?.addEventListener('click', () => { modifica(st => { st.beni = st.beni.filter(x => x.id !== b.id); }); chiudi(); });
  });
}
