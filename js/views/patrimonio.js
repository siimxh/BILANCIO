// Patrimonio: quanto vali in soldi oggi, come si muove, dove arrivi.
import { $, esc, eur, eur0, big, icon, card, today, dataLunga, MESI3, parse, uid, round2, toast, pct } from '../util.js';
import * as E from '../engine.js';
import * as C from '../charts.js';
import { modifica } from '../store.js';
import { pacingBlock } from './dashboard.js';
import { apri, chiudi } from './forms.js';

const GRUPPI_HAI = [
  ['banca', 'Conti in banca', '#3BA0FF', '#1E5BD8'],
  ['contanti', 'Contanti', '#39C6E0', '#1F8FB0'],
  ['risparmio', 'Salvadanai', '#A35BFF', '#6B3FD0'],
  ['tasse', 'Fondo tasse', '#5FD6C0', '#2E9C8A'],
  ['investimento', 'Investimenti', '#E07BFF', '#B04BD0'],
  ['beni', 'Beni', '#9EC9FF', '#5A8FD8'],
];
const DEBT = [['#FF9A5C', '#E0602A'], ['#FF7A3D', '#C94A1E'], ['#FFB38F', '#E07B4F'], ['#F2895F', '#B8502C']];

export function patrimonio(root, { s, mobile }) {
  const oggi = today(), P = E.pacing(s, oggi), now = E.patrimonio(s, oggi);
  const inizioAnno = oggi.slice(0, 4) + '-01-01';
  const pa = E.patrimonio(s, E.primaData(s) > inizioAnno ? E.primaData(s) : inizioAnno);
  const varAnno = now.netto - pa.netto;

  // cosa hai, raggruppato
  const hai = GRUPPI_HAI.map(([k, nome, c1, c2]) => {
    const voci = k === 'beni' ? s.beni.map(b => ({ id: b.id, nome: b.nome, v: +b.valore || 0, bene: true })) : now.conti.filter(c => c.tipo === k).map(c => ({ nome: c.nome, v: Math.max(0, c.saldo) }));
    return { k, nome, c1, c2, voci, tot: round2(voci.reduce((a, x) => a + x.v, 0)) };
  }).filter(g => g.voci.length || g.k === 'beni');
  const totHai = round2(hai.reduce((a, g) => a + g.tot, 0));
  // cosa devi: ogni debito + tasse
  const debiti = s.impegni.filter(E.isDebito).map((i, k) => ({ nome: i.nome, v: E.residuoAl(i, oggi), fine: E.fineDebito(i), c: DEBT[k % DEBT.length] })).filter(d => d.v > 0);
  const devi = debiti.concat(now.tasse > 0 ? [{ nome: 'Tasse da pagare', v: now.tasse, c: ['#FF6B7A', '#D9304A'] }] : []);
  const totDevi = round2(devi.reduce((a, x) => a + x.v, 0));
  const scala = Math.max(totHai, totDevi, 1);
  const seg = (v, c1, c2, label) => v > 0 ? `<div class="sb" style="width:${v / scala * 100}%;background:linear-gradient(180deg,${c1},${c2})" data-tip="${esc(label)}: ${eur(v)}">${v / scala > .1 ? `<span>${esc(label)}</span>` : ''}</div>` : '';
  const perc = v => totHai ? Math.round(v / totHai * 100) + '%' : '';

  root.innerHTML = `
  <div class="hello"><div><h1>Patrimonio</h1><p>Tutto quello che hai, meno tutto quello che devi.</p></div></div>
  <div class="g">
    <section class="card s12">
      <div class="eq">
        <div class="eqt hai"><span class="k">Cosa hai</span><span class="big n">${big(totHai, 0)}</span></div>
        <span class="eqop">−</span>
        <div class="eqt devi"><span class="k">Cosa devi</span><span class="big n">${big(totDevi, 0)}</span></div>
        <span class="eqop">=</span>
        <div class="eqt net"><span class="k">Patrimonio netto</span><span class="big n">${big(now.netto, 0)}</span><span class="sub">${varAnno >= 0 ? '+' : ''}${eur0(varAnno)} da inizio anno</span></div>
      </div>
      <div class="stk"><span class="stl">Hai</span><div class="sbar">${hai.map(g => seg(g.tot, g.c1, g.c2, g.nome)).join('')}</div></div>
      <div class="stk"><span class="stl">Devi</span><div class="sbar">${devi.map(d => seg(d.v, d.c[0], d.c[1], d.nome)).join('') || '<span class="muted" style="font-size:.85rem;padding-left:4px">niente</span>'}</div></div>
      <p class="kid">Le due barre usano la stessa scala: se quella sopra è più lunga, hai più di quanto devi.</p>
    </section>

    <section class="card s6">
      <div class="ch"><span class="ic">${icon.plus}</span><h3>Cosa hai</h3><button class="btn sm" style="margin-left:auto" data-a="bene">＋ Bene</button></div>
      <div class="grp">${hai.map(g => `<div class="gh"><span class="dot" style="background:${g.c1}"></span><b>${g.nome}</b><span class="muted">${perc(g.tot)}</span><span class="n gv">${eur(g.tot)}</span></div>
        ${g.voci.map(v => `<div class="gi" ${v.bene ? `data-bene="${v.id}" style="cursor:pointer"` : ''}><span>${esc(v.nome)}</span><span class="n">${eur(v.v)}</span></div>`).join('') || (g.k === 'beni' ? '<div class="gi muted"><span>Auto, scooter, PC… quello che potresti rivendere. Metti il valore di oggi.</span></div>' : '')}`).join('')}</div>
    </section>
    <section class="card s6">
      <div class="ch"><span class="ic">${icon.minus}</span><h3>Cosa devi</h3><span class="go" data-go="impegni" style="cursor:pointer">↗</span></div>
      <div class="grp">${devi.map(d => `<div class="gh"><span class="dot" style="background:${d.c[0]}"></span><b>${esc(d.nome)}</b><span class="muted">${d.fine ? 'finisce ' + MESI3[parse(d.fine).getMonth()] + ' ' + parse(d.fine).getFullYear() : ''}</span><span class="n gv neg">${eur(d.v)}</span></div>`).join('') || '<p class="empty">Nessun debito. Bello.</p>'}</div>
      ${totDevi ? `<p class="kid">I debiti si mangiano il <b>${totHai ? Math.round(totDevi / totHai * 100) : 100}%</b> di quello che hai.</p>` : ''}
    </section>

    <section class="card s12">
      <div class="ch"><span class="ic">${icon.line}</span><h3>Pacing: dove arrivi a questo ritmo</h3></div>
      ${pacingBlock(P, mobile)}
    </section>
  </div>`;
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
