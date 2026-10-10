// Resoconti: mese per mese, per studiare l'andamento nel tempo.
import { esc, eur, eur0, pct, icon, card, MESI, MESI3, parse, cap, today } from '../util.js';
import * as E from '../engine.js';
import * as C from '../charts.js';

export function resoconti(root, { s, per }) {
  // con un periodo corto mostro tutto l'anno di quel periodo
  const corto = per.modo === 'mese' || (per.modo === 'custom' && per.end.slice(0, 7) === per.start.slice(0, 7));
  const range = corto ? E.periodo('anno', per.start) : per;
  const rows = E.perMese(s, range.start, range.end < today() ? range.end : today());
  const tot = E.stats(s, { ...range, end: range.end < today() ? range.end : today() });
  const medie = k => rows.length ? rows.reduce((a, r) => a + r[k], 0) / rows.length : 0;
  const best = [...rows].sort((a, b) => b.saldo - a.saldo)[0], worst = [...rows].sort((a, b) => a.saldo - b.saldo)[0];

  root.innerHTML = `
  <div class="hello"><div><h1>Resoconti</h1><p>${esc(E.etichetta(range))}, mese per mese${corto ? ' (hai scelto un mese: ti mostro il suo anno)' : ''}.</p></div></div>
  <div class="g">
    <section class="card s3"><div class="ch"><span class="ic">${icon.plus}</span><h3>Entrate medie</h3></div><div class="mid n">${eur(medie('disponibili'))}</div><span class="sub">al mese, tasse già tolte</span></section>
    <section class="card s3"><div class="ch"><span class="ic">${icon.minus}</span><h3>Spese medie</h3></div><div class="mid n">${eur(medie('spese'))}</div><span class="sub">al mese</span></section>
    <section class="card s3"><div class="ch"><span class="ic">${icon.flag}</span><h3>Mese migliore</h3></div><div class="mid n pos">${best ? eur(best.saldo) : '—'}</div><span class="sub">${best ? cap(MESI[parse(best.mese).getMonth()]) : ''}</span></section>
    <section class="card s3"><div class="ch"><span class="ic">${icon.clock}</span><h3>Mese peggiore</h3></div><div class="mid n ${worst?.saldo < 0 ? 'neg' : ''}">${worst ? eur(worst.saldo) : '—'}</div><span class="sub">${worst ? cap(MESI[parse(worst.mese).getMonth()]) : ''}</span></section>

    <section class="card s12">
      <div class="ch"><span class="ic">${icon.bars}</span><h3>Entrate e spese</h3></div>
      <div class="lg"><span><i style="background:var(--cyan)"></i>Entrate</span><span><i style="background:var(--mag)"></i>Spese</span></div>
      ${C.columns(rows.map(r => ({ a: r.disponibili, b: r.spese, label: cap(MESI[parse(r.mese).getMonth()]) + ' ' + parse(r.mese).getFullYear(), short: MESI3[parse(r.mese).getMonth()] })))}
    </section>

    <section class="card s12">
      <div class="ch"><span class="ic">${icon.bars}</span><h3>Tabella</h3></div>
      <div class="tblwrap"><table class="tbl">
        <thead><tr><th>Mese</th><th class="r">Da lavoro</th><th class="r hide-s">Tasse</th><th class="r hide-s">Altre entrate</th><th class="r">Spese</th><th class="r hide-s">Fisse</th><th class="r hide-s">Desideri</th><th class="r">Saldo</th><th class="r">Risparmio</th><th class="r hide-s">Nei salvadanai</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${cap(MESI[parse(r.mese).getMonth()])}</td><td class="r n">${eur(r.entLavoro)}</td><td class="r n hide-s">${eur(r.tasse)}</td><td class="r n hide-s">${eur(r.entAltre)}</td><td class="r n">${eur(r.spese)}</td><td class="r n hide-s">${eur(r.fisse)}</td><td class="r n hide-s">${eur(r.desideri)}</td><td class="r n ${r.saldo >= 0 ? 'pos' : 'neg'}">${eur(r.saldo)}</td><td class="r"><span class="st ${E.voto.risparmio(r.tassoRisparmio)}">${E.fmtRisp(r.tassoRisparmio)}</span></td><td class="r n hide-s">${eur(r.versatoRisparmi)}</td></tr>`).join('')}
        <tr><td><b>Totale</b></td><td class="r n"><b>${eur(tot.entLavoro)}</b></td><td class="r n hide-s">${eur(tot.tasse)}</td><td class="r n hide-s">${eur(tot.entAltre)}</td><td class="r n"><b>${eur(tot.spese)}</b></td><td class="r n hide-s">${eur(tot.fisse)}</td><td class="r n hide-s">${eur(tot.desideri)}</td><td class="r n ${tot.saldo >= 0 ? 'pos' : 'neg'}"><b>${eur(tot.saldo)}</b></td><td class="r"><span class="st ${E.voto.risparmio(tot.tassoRisparmio)}">${E.fmtRisp(tot.tassoRisparmio)}</span></td><td class="r n hide-s">${eur(tot.versatoRisparmi)}</td></tr></tbody>
      </table></div>
    </section>

    <section class="card s12 c-ai">
      <div class="ch"><h3>Report automatici</h3><span class="tag" style="margin-left:auto">in arrivo</span></div>
      <p style="font-size:1.1rem">Un resoconto a fine mese, fatto bene come una presentazione, <span>e uno ogni settimana quando Revolut si aggiorna da solo.</span></p>
    </section>
  </div>`;
}
