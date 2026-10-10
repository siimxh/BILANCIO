// Obiettivi: per cosa metti via i soldi. Quota al mese, in linea o in ritardo, ordine di priorità.
import { $, esc, eur, eur0, big, icon, today, dataLunga, uid, round2, toast } from '../util.js';
import * as E from '../engine.js';
import * as C from '../charts.js';
import { modifica } from '../store.js';
import { apri, chiudi, optConti } from './forms.js';

const STATO = { ok: 'In linea', warn: 'Un po\' indietro', bad: 'In ritardo', neu: 'Senza scadenza' };

export function obiettivi(root, { s }) {
  const oggi = today();
  const obs = s.obiettivi.map(o => E.obiettivo(s, o, oggi));
  const aperti = obs.filter(o => !o.fatto);
  const quote = round2(aperti.reduce((a, o) => a + o.quota, 0));
  const K = E.indicatori(s, oggi);

  root.innerHTML = `
  <div class="hello"><div><h1>Obiettivi</h1><p>Prima paghi te stesso: queste quote si spostano appena entrano i soldi.</p></div>
    <div class="btns"><button class="btn pri" data-a="nuovo">＋ Nuovo obiettivo</button></div></div>
  <div class="g">
    <section class="card s4" style="background:radial-gradient(90% 80% at 50% 0%, rgba(255,122,61,.14), transparent 60%), linear-gradient(180deg,#22181A,#161113);border-color:rgba(255,122,61,.2)">
      <div class="ch"><h3>Da mettere via ogni mese</h3></div>
      <div class="big n">${big(quote, 0)}</div>
      ${C.ruler(quote, Math.max(300, quote * 1.3))}
      <p class="kid">Somma delle quote di tutti gli obiettivi aperti. Le tue entrate medie sono ${eur0(K.disponibili)} al mese: ${K.disponibili ? `le quote ne prendono il <b>${Math.round(quote / K.disponibili * 100)}%</b>` : 'servono più dati'}.</p>
    </section>
    <section class="card s8">
      <div class="ch"><span class="ic">${icon.flag}</span><h3>Ordine di priorità</h3></div>
      <p class="kid">Si riempiono dall'alto verso il basso: se un mese i soldi non bastano, si salta da sotto. Sposta con le frecce. <b>L'ordine giusto lo decidiamo insieme man mano</b>; un consiglio da commercialista: prima tasse e cuscinetto di emergenza, poi i debiti, poi i sogni.</p>
      <div class="list">${obs.map((o, k) => `<div class="item"><div style="display:flex;gap:12px;align-items:center;min-width:0"><span class="goal"><span class="pr">${k + 1}</span></span><div style="min-width:0"><h4>${esc(o.nome)}</h4><span class="meta">${o.fatto ? 'Fatto' : o.quota ? `${eur0(o.quota)} al mese` : 'nessuna quota'}</span></div></div>
        <div class="goal"><div class="ord"><button data-up="${k}" aria-label="Su" ${k === 0 ? 'disabled' : ''}>↑</button><button data-down="${k}" aria-label="Giù" ${k === obs.length - 1 ? 'disabled' : ''}>↓</button></div></div></div>`).join('') || '<p class="empty">Nessun obiettivo.</p>'}</div>
    </section>

    ${obs.map(o => `<section class="card s4 goal">
      <div class="gh"><h3 style="font-size:1.05rem">${esc(o.nome)}</h3><span class="st ${o.fatto ? 'ok' : o.stato}" style="margin-left:auto">${o.fatto ? 'Fatto' : STATO[o.stato]}</span></div>
      <div style="display:grid;grid-template-columns:1fr 110px;align-items:center;gap:10px">
        <div><div class="sub">Messi da parte</div><div class="big n" style="font-size:2rem">${big(o.messo, 0)}</div><div class="sub">di ${eur0(o.target)}${o.scadenza ? ` entro il ${dataLunga(o.scadenza)}` : ''}</div></div>
        ${C.ring(o.prog)}
      </div>
      ${C.pbar(o.prog, 'linear-gradient(90deg,#8E5BFF,#E07BFF)', 16)}
      <p class="kid">${o.fatto ? 'Raggiunto. 🎉' : o.mesiRim ? `Mancano <b class="n">${eur(o.mancano)}</b>: servono <b class="n">${eur0(o.quota)}</b> al mese per ${o.mesiRim} ${o.mesiRim === 1 ? 'mese' : 'mesi'}.` : `Mancano ${eur(o.mancano)}. Metti una scadenza per sapere quanto al mese.`}
        ${o.atteso != null && !o.fatto ? `<br>A oggi dovresti essere a ${eur0(o.atteso)}.` : ''}
        ${o.conto ? `<br>Collegato al salvadanaio <b>${esc(E.contoById(s, o.conto)?.nome || '')}</b>: si aggiorna da solo.` : ''}</p>
      <div class="btns"><button class="btn sm cy" data-versa="${o.id}">＋ Metti soldi</button><button class="btn sm ghost" data-ed="${o.id}">Modifica</button></div>
    </section>`).join('')}
  </div>`;

  root.querySelector('[data-a="nuovo"]').onclick = () => formObiettivo(s);
  root.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => formObiettivo(s, s.obiettivi.find(o => o.id === b.dataset.ed)));
  root.querySelectorAll('[data-versa]').forEach(b => b.onclick = () => versa(s, s.obiettivi.find(o => o.id === b.dataset.versa)));
  const muovi = (k, d) => modifica(st => { const a = st.obiettivi; [a[k], a[k + d]] = [a[k + d], a[k]]; });
  root.querySelectorAll('[data-up]').forEach(b => b.onclick = () => muovi(+b.dataset.up, -1));
  root.querySelectorAll('[data-down]').forEach(b => b.onclick = () => muovi(+b.dataset.down, 1));
}

function versa(s, o) {
  const info = E.obiettivo(s, o);
  apri('Metti soldi: ' + esc(o.nome), `
    <form class="form" id="vf">
      <label class="f">Quanto (€)<input name="imp" type="number" step="0.01" min="0" required value="${info.quota || ''}"></label>
      ${o.conto ? `<label class="f">Da quale conto<select name="da">${optConti(s, E.principale(s).id, c => c.id !== o.conto)}</select></label>
        <p class="kid">Registro uno <b>spostamento</b> verso "${esc(E.contoById(s, o.conto)?.nome)}": non è una spesa, i soldi restano tuoi.</p>`
        : '<p class="kid">Questo obiettivo non ha un salvadanaio collegato: aumento solo il contatore. Se vuoi che si aggiorni da solo, collegalo a un salvadanaio in Modifica.</p>'}
      <button class="btn pri" type="submit">Metti da parte</button>
    </form>`, d => {
    const f = $('#vf', d);
    f.onsubmit = e => {
      e.preventDefault(); const v = round2(+f.imp.value); if (!(v > 0)) return;
      modifica(st => {
        if (o.conto) st.movimenti.push({ id: uid(), data: today(), tipo: 'trasferimento', importo: v, conto: f.da.value, contoDest: o.conto, descr: 'Per: ' + o.nome });
        else { const x = st.obiettivi.find(y => y.id === o.id); x.messo = round2((+x.messo || 0) + v); }
      });
      chiudi(); toast('Messo da parte');
    };
  });
}

function formObiettivo(s, o = null) {
  const nuovo = !o;
  o = o ? { ...o } : { id: uid(), creato: today() };
  const salvadanai = s.conti.filter(c => c.tipo === 'risparmio' || c.tipo === 'investimento' || c.tipo === 'tasse');
  apri(nuovo ? 'Nuovo obiettivo' : 'Modifica obiettivo', `
    <form class="form" id="of">
      <label class="f">Cosa vuoi raggiungere<input name="nome" required value="${esc(o.nome || '')}" placeholder="es. Patente A2, Acconto auto"></label>
      <div class="fr">
        <label class="f">Quanto serve (€)<input name="target" type="number" step="1" min="0" required value="${o.target ?? ''}"></label>
        <label class="f">Entro quando<input name="scadenza" type="date" value="${o.scadenza || ''}"></label>
      </div>
      <label class="f">Salvadanaio collegato<select name="conto"><option value="">Nessuno: lo aggiorno a mano</option>${salvadanai.map(c => `<option value="${c.id}" ${o.conto === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
      <label class="f" id="omesso">Già messi da parte (€)<input name="messo" type="number" step="0.01" min="0" value="${o.messo ?? 0}"></label>
      <p class="kid">Consiglio: un salvadanaio Revolut per ogni obiettivo. Crealo in Impostazioni → Conti, poi collegalo qui: il tool lo legge da solo.</p>
      <div class="btns"><button class="btn pri" type="submit">${nuovo ? 'Aggiungi' : 'Salva'}</button>${nuovo ? '' : '<button class="btn danger" type="button" id="odel">Elimina</button>'}</div>
    </form>`, d => {
    const f = $('#of', d), sync = () => $('#omesso', d).hidden = !!f.conto.value;
    sync(); f.conto.onchange = sync;
    f.onsubmit = e => {
      e.preventDefault();
      const out = { ...o, nome: f.nome.value.trim(), target: round2(+f.target.value), scadenza: f.scadenza.value || null, conto: f.conto.value || null, messo: round2(+f.messo.value || 0) };
      modifica(st => { const k = st.obiettivi.findIndex(x => x.id === o.id); if (k >= 0) st.obiettivi[k] = out; else st.obiettivi.push(out); });
      chiudi(); toast('Salvato');
    };
    $('#odel', d)?.addEventListener('click', () => { if (confirm('Eliminare questo obiettivo?')) { modifica(st => { st.obiettivi = st.obiettivi.filter(x => x.id !== o.id); }); chiudi(); } });
  });
}
