// Movimenti: la prima nota. Aggiungi, cerca, correggi, importa l'estratto conto.
import { $, esc, eur, icon, card, dataBreve, toast } from '../util.js';
import * as E from '../engine.js';
import { modifica } from '../store.js';
import { TIPI_MOV } from '../model.js';
import { formMovimento, formContanti, apri, chiudi, optConti } from './forms.js';
import { leggi, chiave } from '../importa.js';

let filtro = { conto: '', tipo: '', cat: '', q: '', controllare: false };

export function movimenti(root, { s, per, sotto }) {
  const st = E.stats(s, per);
  const lista = s.movimenti.filter(m => m.data >= per.start && m.data <= per.end)
    .filter(m => !filtro.conto || m.conto === filtro.conto || m.contoDest === filtro.conto)
    .filter(m => !filtro.tipo || m.tipo === filtro.tipo)
    .filter(m => !filtro.cat || m.categoria === filtro.cat)
    .filter(m => !filtro.controllare || m.daControllare)
    .filter(m => !filtro.q || `${m.descr} ${m.note || ''} ${m.categoria || ''}`.toLowerCase().includes(filtro.q.toLowerCase()))
    .sort((a, b) => b.data.localeCompare(a.data));
  const nome = id => E.contoById(s, id)?.nome || '?';
  const saldi = E.saldi(s);

  root.innerHTML = `
  <div class="hello"><div><h1>Movimenti</h1><p>${esc(E.etichetta(per))} · ${lista.length} movimenti</p></div>
    <div class="btns"><button class="btn pri" data-a="nuovo">＋ Nuovo movimento</button><button class="btn" data-a="contanti">＋ Spesa in contanti</button><button class="btn" data-a="importa">↑ Importa estratto conto</button></div></div>
  <div class="g">
    <section class="card s8">
      <div class="filters">
        <label class="f">Cerca<input id="fq" value="${esc(filtro.q)}" placeholder="descrizione, nota…"></label>
        <label class="f">Conto<select id="fc"><option value="">Tutti</option>${optConti(s, filtro.conto)}</select></label>
        <label class="f">Tipo<select id="ft"><option value="">Tutti</option>${Object.entries(TIPI_MOV).map(([k, t]) => `<option value="${k}" ${filtro.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="f">Categoria<select id="fk"><option value="">Tutte</option>${s.categorie.map(c => `<option ${filtro.cat === c.nome ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
      </div>
      <label class="chk"><input type="checkbox" id="fx" ${filtro.controllare ? 'checked' : ''}> Solo quelli da controllare (${st.daControllare})</label>
      <div class="tblwrap"><table class="tbl">
        <thead><tr><th>Data</th><th>Descrizione</th><th class="hide-s">Categoria / conti</th><th class="r">Importo</th></tr></thead>
        <tbody>${lista.slice(0, 400).map(m => `<tr class="click" data-id="${m.id}">
          <td class="n">${dataBreve(m.data)}</td>
          <td>${esc(m.descr || '(senza descrizione)')} ${m.daControllare ? '<span class="badge c">controlla</span>' : ''}${m.tipo === 'entrata' && !m.lavoro ? ' <span class="badge t">non lavoro</span>' : ''}</td>
          <td class="hide-s">${m.tipo === 'trasferimento' ? `<span class="badge t">${esc(nome(m.conto))} → ${esc(nome(m.contoDest))}</span>` : `<span class="badge ${m.tipo === 'entrata' ? 'e' : m.tipo === 'rimborso' ? 'e' : 's'}">${esc(m.tipo === 'entrata' ? (m.lavoro ? 'Lavoro' : 'Altra entrata') : m.categoria || 'Senza categoria')}</span> <span class="muted" style="font-size:.8rem">${esc(nome(m.conto))}</span>`}</td>
          <td class="r n ${m.tipo === 'entrata' || m.tipo === 'rimborso' ? 'pos' : m.tipo === 'trasferimento' ? 'fg2' : ''}">${m.tipo === 'spesa' ? '−' : m.tipo === 'trasferimento' ? '⇄ ' : '+'}${eur(m.importo)}</td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty">Nessun movimento con questi filtri.</td></tr>'}</tbody>
      </table></div>
      ${lista.length > 400 ? '<p class="kid">Mostro i 400 più recenti: restringi il periodo per vedere gli altri.</p>' : ''}
    </section>
    <div class="s4 stack">
      ${card('Saldi di oggi', icon.bars, `<div class="list">${saldi.map(c => `<div class="item"><div><h4>${esc(c.nome)}</h4><span class="meta">${esc({ banca: 'Conto', contanti: 'Portafoglio', risparmio: 'Salvadanaio', tasse: 'Salvadanaio tasse', investimento: 'Investimenti' }[c.tipo])}</span></div><span class="mid n" style="font-size:1.15rem">${eur(c.saldo)}</span></div>`).join('')}</div>`)}
      ${card('Contanti', icon.cash, `<p class="kid">Il problema dei contanti si risolve così:</p>
        <p class="kid">1. Prelievo = <b>spostamento</b> da ${esc(E.principale(s).nome)} a Contanti (Revolut lo importa già così).<br>2. Quando paghi in contanti, segnalo come spesa dal conto <b>Contanti</b>.<br>3. Ogni tanto apri il portafoglio e premi <b>Conta i contanti</b>: quello che manca diventa "Contanti non segnati".</p>
        <p class="kid">Se ti pagano in contanti per lavoro, segnalo come <b>entrata da lavoro</b> sul conto Contanti: conta per le tasse come tutto il resto.</p>
        <button class="btn" data-a="conta">Conta i contanti</button>`)}
      ${card('Riepilogo del periodo', icon.flag, `<div class="ce">
        <div class="r"><span class="op">+</span><span>Entrate</span><span class="v n">${eur(st.entLavoro + st.entAltre)}</span></div>
        <div class="r"><span class="op">−</span><span>Spese (meno i rimborsi)</span><span class="v n">${eur(st.spese)}</span></div>
        <div class="r"><span class="op">⇄</span><span>Nei salvadanai</span><span class="v n">${eur(st.versatoRisparmi)}</span></div>
        <div class="r"><span class="op">⇄</span><span>Investiti</span><span class="v n">${eur(st.investito)}</span></div>
        <div class="r"><span class="op">⇄</span><span>Prelevati in contanti</span><span class="v n">${eur(st.prelievi)}</span></div></div>`)}
    </div>
  </div>`;

  const on = (id, ev, fn) => $(id, root).addEventListener(ev, fn);
  const rerender = () => movimenti(root, { s, per });
  on('#fq', 'change', e => { filtro.q = e.target.value; rerender(); });
  on('#fc', 'change', e => { filtro.conto = e.target.value; rerender(); });
  on('#ft', 'change', e => { filtro.tipo = e.target.value; rerender(); });
  on('#fk', 'change', e => { filtro.cat = e.target.value; rerender(); });
  on('#fx', 'change', e => { filtro.controllare = e.target.checked; rerender(); });
  root.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => formMovimento(s.movimenti.find(m => m.id === tr.dataset.id)));
  root.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'nuovo') formMovimento();
    if (a === 'contanti') formMovimento(null, { tipo: 'spesa', conto: s.conti.find(c => c.tipo === 'contanti')?.id });
    if (a === 'conta') formContanti();
    if (a === 'importa') formImporta(s);
  });
  if (sotto === 'importa') { history.replaceState(null, '', '#movimenti'); formImporta(s); }
}

function formImporta(s) {
  apri('Importa estratto conto', `
    <p class="kid">Da Revolut: <b>Conto → ⋯ → Estratto conto → Excel/CSV</b>, scegli le date e scarica. Poi caricalo qui.</p>
    <p class="kid">Funziona anche un CSV semplice con le colonne <b>data; descrizione; importo; categoria</b> (spese col meno davanti).</p>
    <p class="kid">I doppioni li salto da solo. Quello che importo lo segno <b>"da controllare"</b>: dai un'occhiata a categorie e entrate (lavoro o no).</p>
    <label class="f">Su quale conto<select id="ic">${optConti(s, E.principale(s).id)}</select></label>
    <label class="f">File CSV<input type="file" id="if" accept=".csv,text/csv,text/plain"></label>
    <div id="ip"></div>
    <p class="kid muted">Collegamento automatico con Revolut: in arrivo (Enable Banking), lo attiviamo insieme al primo avvio online.</p>`, d => {
    let pronti = [];
    $('#if', d).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const text = await f.text();
      const r = leggi(text, s, $('#ic', d).value);
      const esistenti = new Set(s.movimenti.map(chiave));
      pronti = r.movimenti.filter(m => !esistenti.has(chiave(m)));
      const dup = r.movimenti.length - pronti.length;
      const conta = t => pronti.filter(m => m.tipo === t).length;
      $('#ip', d).innerHTML = r.movimenti.length ? `
        <div class="item"><div><h4>${pronti.length} movimenti nuovi</h4><span class="meta">Formato: ${r.formato} · ${conta('spesa')} spese, ${conta('entrata')} entrate, ${conta('trasferimento')} spostamenti, ${conta('rimborso')} rimborsi${dup ? ` · ${dup} doppioni saltati` : ''}</span></div>
        <button class="btn pri" id="igo" ${pronti.length ? '' : 'disabled'}>Importa</button></div>`
        : `<p class="kid neg">Non riesco a leggere questo file${r.colonne ? ` (colonne trovate: ${esc(r.colonne.join(', '))})` : ''}.</p>`;
      $('#igo', d)?.addEventListener('click', () => { modifica(st => st.movimenti.push(...pronti)); chiudi(); toast(`Importati ${pronti.length} movimenti`); });
    };
  });
}
