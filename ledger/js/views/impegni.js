// Impegni: rate, debiti, abbonamenti, spese annuali. Cosa devi pagare e quando.
import { $, esc, eur, eur0, big, icon, card, today, dataLunga, dataBreve, addMonths, monthStart, monthEnd, MESI3, parse, uid, round2, toast } from '../util.js';
import * as E from '../engine.js';
import { modifica } from '../store.js';
import { TIPI_IMPEGNO, FREQ } from '../model.js';
import { apri, chiudi, optConti } from './forms.js';

export function impegni(root, { s }) {
  const oggi = today(), ms = monthStart(oggi);
  const debiti = s.impegni.filter(E.isDebito), altri = s.impegni.filter(i => !E.isDebito(i));
  const totDebiti = E.debitiTotali(s, oggi);
  const alMese = s.impegni.reduce((a, i) => a + (i.frequenza === 'mensile' && (!E.isDebito(i) || E.residuoAl(i, oggi) > 0) ? +i.importo || 0 : 0), 0);
  const annuali = s.impegni.filter(i => i.frequenza === 'annuale').reduce((a, i) => a + (+i.importo || 0), 0);
  const mesi = Array.from({ length: 12 }, (_, k) => addMonths(ms, k));
  const prossimi = E.pagamenti(s, oggi, addMonths(oggi, 1));

  root.innerHTML = `
  <div class="hello"><div><h1>Impegni</h1><p>Rate, debiti, abbonamenti e spese che arrivano una volta l'anno.</p></div>
    <div class="btns"><button class="btn pri" data-a="nuovo">＋ Nuovo impegno</button></div></div>
  <div class="g">
    <section class="card s4 c-pay"><div class="ch"><h3>Debiti ancora da pagare</h3></div><div class="big n">${big(totDebiti)}</div><span class="sub" style="color:#F2C9B8">${debiti.length} tra rate e persone</span></section>
    <section class="card s4"><div class="ch"><span class="ic">${icon.clock}</span><h3>Impegni ogni mese</h3></div><div class="big n" style="font-size:2rem">${big(alMese)}</div><p class="kid">Rate e abbonamenti che escono tutti i mesi.</p></section>
    <section class="card s4"><div class="ch"><span class="ic">${icon.flag}</span><h3>Spese annuali</h3></div><div class="big n" style="font-size:2rem">${big(annuali)}</div><p class="kid">Divise in quote fanno <b class="n">${eur(annuali / 12)}</b> al mese da mettere via, così quando arrivano non fanno male.</p></section>

    <section class="card s12">
      <div class="ch"><span class="ic">${icon.line}</span><h3>Linea del tempo: prossimi 12 mesi</h3></div>
      <div class="tl">${mesi.map(m => { const p = E.pagamenti(s, m, monthEnd(m)), tot = p.reduce((a, x) => a + x.importo, 0);
        return `<div class="m ${m === ms ? 'now' : ''}"><div class="h"><span>${MESI3[parse(m).getMonth()]} ${String(parse(m).getFullYear()).slice(2)}</span><span class="n">${eur0(tot)}</span></div>
          ${p.map(x => `<div class="p" data-tip="${esc(x.imp.nome)}\n${dataLunga(x.data)}\n${eur(x.importo)}"><b>${esc(x.imp.nome)}</b><span class="n">${parse(x.data).getDate()} · ${eur(x.importo)}</span></div>`).join('') || '<span class="muted" style="font-size:.8rem">niente</span>'}</div>`; }).join('')}</div>
    </section>

    <section class="card s7">
      <div class="ch"><span class="ic">${icon.minus}</span><h3>Debiti e rate</h3></div>
      <div class="list">${debiti.map(i => { const r = E.residuoAl(i, oggi), fine = E.fineDebito(i), all = Math.max(r, +i.residuo || 0, 1);
        return `<div class="item click" data-id="${i.id}" style="cursor:pointer"><div style="display:grid;gap:8px"><div><h4>${esc(i.nome)}</h4><span class="meta">${esc(TIPI_IMPEGNO[i.tipo])}${+i.importo ? ` · ${eur(i.importo)} ${i.frequenza === 'mensile' ? 'al mese' : i.frequenza === 'annuale' ? "all'anno" : ''}` : ' · senza rate fisse'}${fine ? ` · finisce a ${MESI3[parse(fine).getMonth()]} ${parse(fine).getFullYear()}` : ''}</span></div>
          <div class="minibar"><div class="f" style="width:${Math.min(100, r / all * 100)}%;background:linear-gradient(90deg,#D9502A,#FF7A3D)"></div><div class="rest"></div></div></div>
          <span class="mid n" style="font-size:1.2rem">${eur(r)}</span></div>`; }).join('') || '<p class="empty">Nessun debito. Bello.</p>'}</div>
    </section>

    <section class="card s5">
      <div class="ch"><span class="ic">${icon.bars}</span><h3>Abbonamenti e spese ricorrenti</h3></div>
      <div class="list">${altri.map(i => `<div class="item click" data-id="${i.id}" style="cursor:pointer"><div><h4>${esc(i.nome)}</h4><span class="meta">${esc(TIPI_IMPEGNO[i.tipo])} · ${esc(FREQ[i.frequenza])}${i.frequenza === 'annuale' ? ` · costa ${eur(i.importo / 12)} al mese` : ''}</span></div><span class="mid n" style="font-size:1.1rem">${eur(i.importo)}</span></div>`).join('') || '<p class="empty">Nessun abbonamento.</p>'}</div>
      <p class="kid">Nel prossimo mese escono <b class="n">${eur(prossimi.reduce((a, x) => a + x.importo, 0))}</b> in ${prossimi.length} pagamenti.</p>
    </section>
  </div>
  <p class="foot">Gli impegni sono il piano: le uscite vere restano nei Movimenti. Il residuo dei debiti scende da solo a ogni rata prevista; se salti o anticipi una rata, aggiorna il residuo.</p>`;

  root.querySelector('[data-a="nuovo"]').onclick = () => formImpegno(s);
  root.querySelectorAll('[data-id]').forEach(el => el.onclick = () => formImpegno(s, s.impegni.find(i => i.id === el.dataset.id)));
}

function formImpegno(s, i = null) {
  const nuovo = !i;
  i = i ? { ...i } : { id: uid(), tipo: 'rata', frequenza: 'mensile', inizio: today(), importo: '', conto: E.principale(s).id };
  apri(nuovo ? 'Nuovo impegno' : 'Modifica impegno', `
    <form class="form" id="if">
      <label class="f">Nome<input name="nome" required value="${esc(i.nome || '')}" placeholder="es. Rata telefono, Debito con Marco, Netflix"></label>
      <div class="fr">
        <label class="f">Tipo<select name="tipo">${Object.entries(TIPI_IMPEGNO).map(([k, t]) => `<option value="${k}" ${i.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="f">Quanto paghi ogni volta (€)<input name="importo" type="number" step="0.01" min="0" value="${i.importo ?? ''}" placeholder="0 se non ci sono rate"></label>
      </div>
      <div class="fr">
        <label class="f">Ogni quanto<select name="frequenza">${Object.entries(FREQ).map(([k, t]) => `<option value="${k}" ${i.frequenza === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="f">Primo pagamento<input name="inizio" type="date" value="${i.inizio || today()}"></label>
        <label class="f">Ultimo (se lo sai)<input name="fine" type="date" value="${i.fine || ''}"></label>
      </div>
      <div class="fr" id="idebt">
        <label class="f">Quanto manca da pagare (€)<input name="residuo" type="number" step="0.01" min="0" value="${i.residuo ?? ''}"></label>
        <label class="f">Aggiornato al<input name="residuoAl" type="date" value="${i.residuoAl || today()}"></label>
      </div>
      <label class="f">Esce dal conto<select name="conto">${optConti(s, i.conto)}</select></label>
      <label class="f">Nota<input name="note" value="${esc(i.note || '')}"></label>
      <p class="kid">Per un debito: scrivi quanto manca <b>oggi</b>. Il tool lo fa scendere da solo a ogni rata e ti dice quando finisci.</p>
      <div class="btns"><button class="btn pri" type="submit">${nuovo ? 'Aggiungi' : 'Salva'}</button>${nuovo ? '' : '<button class="btn danger" type="button" id="idel">Elimina</button>'}</div>
    </form>`, d => {
    const f = $('#if', d), sync = () => $('#idebt', d).hidden = !['rata', 'debito'].includes(f.tipo.value);
    sync(); f.tipo.onchange = sync;
    f.onsubmit = e => {
      e.preventDefault();
      const out = { id: i.id, nome: f.nome.value.trim(), tipo: f.tipo.value, importo: round2(+f.importo.value || 0), frequenza: f.frequenza.value, inizio: f.inizio.value || today(), fine: f.fine.value || null, conto: f.conto.value, note: f.note.value.trim() };
      if (E.isDebito(out)) { out.residuo = round2(+f.residuo.value || 0); out.residuoAl = f.residuoAl.value || today(); }
      out.giorno = parse(out.inizio).getDate();
      modifica(st => { const k = st.impegni.findIndex(x => x.id === i.id); if (k >= 0) st.impegni[k] = out; else st.impegni.push(out); });
      chiudi(); toast('Salvato');
    };
    $('#idel', d)?.addEventListener('click', () => { if (confirm('Eliminare questo impegno?')) { modifica(st => { st.impegni = st.impegni.filter(x => x.id !== i.id); }); chiudi(); } });
  });
}
