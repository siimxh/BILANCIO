// Resoconti: mese per mese, per studiare l'andamento nel tempo.
import { esc, eur, eur0, pct, icon, card, MESI, MESI3, parse, cap, today } from '../util.js';
import * as E from '../engine.js';
import * as C from '../charts.js';

let dettagli = false;

export function resoconti(root, { s, per, mobile }) {
  // con un periodo corto mostro tutto l'anno di quel periodo
  const corto = per.modo === 'mese' || (per.modo === 'custom' && per.end.slice(0, 7) === per.start.slice(0, 7));
  const range = corto ? E.periodo('anno', per.start) : per;
  const rows = E.perMese(s, range.start, range.end < today() ? range.end : today());
  const tot = E.stats(s, { ...range, end: range.end < today() ? range.end : today() });
  const medie = k => rows.length ? rows.reduce((a, r) => a + r[k], 0) / rows.length : 0;
  const best = [...rows].sort((a, b) => b.saldo - a.saldo)[0], worst = [...rows].sort((a, b) => a.saldo - b.saldo)[0];

  const mesecorr = today().slice(0, 8) + '01';
  const maxSal = Math.max(1, ...rows.map(r => Math.abs(r.saldo)));
  const riga = (nome, r, corr, totale) => `<tr class="${corr ? 'corr' : ''} ${totale ? 'tot' : ''}"><td><b>${nome}</b>${corr ? ' <span class="badge e">in corso</span>' : ''}</td>
    <td class="r n">${eur(r.disponibili)}</td><td class="r n">${eur(r.spese)}</td>
    <td><div class="salbar"><span class="n ${r.saldo >= 0 ? 'pos' : 'neg'}">${r.saldo >= 0 ? '+' : ''}${eur(r.saldo)}</span>${totale ? '' : `<i style="width:${Math.abs(r.saldo) / maxSal * 100}%;background:${r.saldo >= 0 ? 'linear-gradient(90deg,#2E9C8A,#4ADE9B)' : 'linear-gradient(90deg,#D9304A,#FF6B7A)'}"></i>`}</div></td>
    <td class="r"><span class="st ${E.voto.risparmio(r.tassoRisparmio)}">${E.fmtRisp(r.tassoRisparmio)}</span></td>
    ${dettagli ? `<td class="r n">${eur(r.entLavoro)}</td><td class="r n">${eur(r.tasse)}</td><td class="r n">${eur(r.entAltre)}</td><td class="r n">${eur(r.fisse)}</td><td class="r n">${eur(r.desideri)}</td><td class="r n">${eur(r.versatoRisparmi)}</td>` : ''}</tr>`;
  root.innerHTML = `
  <div class="hello"><div><h1>Resoconti</h1><p>${esc(E.etichetta(range))}, mese per mese${corto ? ' (hai scelto un mese: ti mostro il suo anno)' : ''}.</p></div></div>
  <div class="g">
    <section class="card s3"><div class="ch"><span class="ic">${icon.plus}</span><h3>Entrate medie</h3></div><div class="mid n">${eur(medie('disponibili'))}</div><span class="sub">al mese, tasse già tolte</span></section>
    <section class="card s3"><div class="ch"><span class="ic">${icon.minus}</span><h3>Spese medie</h3></div><div class="mid n">${eur(medie('spese'))}</div><span class="sub">al mese</span></section>
    <section class="card s3"><div class="ch"><span class="ic">${icon.flag}</span><h3>Mese migliore</h3></div><div class="mid n pos">${best ? eur(best.saldo) : '—'}</div><span class="sub">${best ? cap(MESI[parse(best.mese).getMonth()]) : ''}</span></section>
    <section class="card s3"><div class="ch"><span class="ic">${icon.clock}</span><h3>Mese peggiore</h3></div><div class="mid n ${worst?.saldo < 0 ? 'neg' : ''}">${worst ? eur(worst.saldo) : '—'}</div><span class="sub">${worst ? cap(MESI[parse(worst.mese).getMonth()]) : ''}</span></section>

    <section class="card s12">
      <div class="ch"><span class="ic">${icon.bars}</span><h3>Entrate e spese, mese per mese</h3></div>
      <div class="lg"><span><i style="background:var(--cyan)"></i>Entrate</span><span><i style="background:var(--mag)"></i>Spese</span><span><i style="background:var(--pos)"></i>Ti è rimasto (sotto ogni mese)</span></div>
      ${C.columns(rows.map(r => ({ a: r.disponibili, b: r.spese, label: cap(MESI[parse(r.mese).getMonth()]) + ' ' + parse(r.mese).getFullYear(), short: MESI3[parse(r.mese).getMonth()] })), mobile ? { W: 420, H: 300, etichette: false } : {})}
    </section>

    <section class="card s12">
      <div class="ch"><span class="ic">${icon.bars}</span><h3>Tabella</h3>${mobile ? '' : `<label class="chk" style="margin-left:auto;font-size:.85rem"><input type="checkbox" id="det" ${dettagli ? 'checked' : ''}> Mostra tutti i dettagli</label>`}</div>
      ${mobile ? `<div class="mesi">${rows.slice().reverse().map(r => `<div class="mese">
          <div class="rowsp"><b>${cap(MESI[parse(r.mese).getMonth()])}</b><span class="st ${E.voto.risparmio(r.tassoRisparmio)}">${E.fmtRisp(r.tassoRisparmio)}</span></div>
          <div class="mg"><span>Entrate</span><b class="n">${eur(r.disponibili)}</b><span>Spese</span><b class="n">${eur(r.spese)}</b><span>Rimasto</span><b class="n ${r.saldo >= 0 ? 'pos' : 'neg'}">${eur(r.saldo)}</b></div></div>`).join('')}</div>`
      : `<div class="tblwrap"><table class="tbl big-tbl">
        <thead><tr><th>Mese</th><th class="r">Entrate</th><th class="r">Spese</th><th>Ti è rimasto</th><th class="r">Risparmio</th>${dettagli ? '<th class="r">Da lavoro</th><th class="r">Tasse</th><th class="r">Altre entrate</th><th class="r">Fisse</th><th class="r">Desideri</th><th class="r">Nei salvadanai</th>' : ''}</tr></thead>
        <tbody>${rows.map(r => riga(cap(MESI[parse(r.mese).getMonth()]), r, r.mese === mesecorr)).join('')}</tbody>
        <tfoot>${riga('Totale', { ...tot, disponibili: tot.disponibili }, false, true)}</tfoot>
      </table></div>`}
    </section>

    <section class="card s12 c-ai">
      <div class="ch"><h3>Report automatici</h3><span class="tag" style="margin-left:auto">in arrivo</span></div>
      <p style="font-size:1.1rem">Un resoconto a fine mese, fatto bene come una presentazione, <span>e uno ogni settimana quando Revolut si aggiorna da solo.</span></p>
    </section>
  </div>`;
  root.querySelector('#det')?.addEventListener('change', e => { dettagli = e.target.checked; resoconti(root, { s, per, mobile }); });
}
