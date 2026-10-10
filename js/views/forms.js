// Finestre di inserimento condivise: movimento, conta contanti.
import { $, esc, uid, today, round2, eur, toast } from '../util.js';
import { modifica, state } from '../store.js';
import { TIPI_MOV } from '../model.js';
import { saldoAl, indovinaCategoria, principale, contoById } from '../engine.js';

export function apri(title, body, onReady) {
  const d = $('#dlg');
  d.innerHTML = `<div class="dh"><h3>${title}</h3><button class="icbtn x" data-close aria-label="Chiudi">✕</button></div><div class="db">${body}</div>`;
  d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => d.close());
  d.showModal();
  onReady?.(d);
  return d;
}
export const chiudi = () => $('#dlg').close();

const optConti = (s, sel, filtro = () => true) => s.conti.filter(filtro).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
const optCat = (s, sel) => `<option value="">— scegli —</option>` + s.categorie.map(c => `<option ${c.nome === sel ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');

// nuovo / modifica movimento. preset: {tipo, conto, ...}
export function formMovimento(m = null, preset = {}) {
  const s = state, nuovo = !m;
  m = m ? { ...m } : { id: uid(), data: today(), tipo: 'spesa', importo: '', conto: principale(s).id, lavoro: true, ...preset };
  const body = `
    <div class="seg" id="mtipo">${Object.entries(TIPI_MOV).map(([k, t]) => `<button type="button" data-t="${k}" class="${m.tipo === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <p class="kid" id="mspieg"></p>
    <form class="form" id="mf">
      <div class="fr">
        <label class="f">Importo (€)<input name="importo" type="number" step="0.01" min="0" inputmode="decimal" required value="${m.importo}" placeholder="0,00"></label>
        <label class="f">Data<input name="data" type="date" required value="${m.data}"></label>
      </div>
      <label class="f">Descrizione<input name="descr" value="${esc(m.descr || '')}" placeholder="es. Conad, Prelievo, Provvigioni"></label>
      <div class="fr">
        <label class="f" id="lconto">Da quale conto<select name="conto">${optConti(s, m.conto)}</select></label>
        <label class="f" data-only="trasferimento">Verso quale conto<select name="contoDest">${optConti(s, m.contoDest || (s.conti.find(c => c.tipo === 'contanti')?.id))}</select></label>
        <label class="f" data-only="spesa rimborso">Categoria<select name="categoria">${optCat(s, m.categoria)}</select></label>
      </div>
      <div data-only="entrata" class="form">
        <label class="chk"><input type="checkbox" name="lavoro" ${m.lavoro !== false ? 'checked' : ''}> È un guadagno da lavoro (provvigioni, stipendio, lavoretti, anche in contanti)</label>
        <p class="kid">Togli la spunta per soldi che <b>non</b> sono lavoro: regali, soldi di famiglia, rimborsi tra amici. Non contano per le tasse.</p>
      </div>
      <div data-only="spesa" class="fr">
        <label class="f">È una…<select name="nd"><option value="">come la categoria</option><option value="necessita" ${m.nd === 'necessita' ? 'selected' : ''}>Necessità</option><option value="desiderio" ${m.nd === 'desiderio' ? 'selected' : ''}>Desiderio</option></select></label>
        <label class="f">Si ripete ogni mese?<select name="fissa"><option value="">come la categoria</option><option value="1" ${m.fissa === true ? 'selected' : ''}>Sì, è fissa</option><option value="0" ${m.fissa === false ? 'selected' : ''}>No</option></select></label>
      </div>
      <label class="f">Nota<input name="note" value="${esc(m.note || '')}"></label>
      <div class="btns">
        <button class="btn pri" type="submit">${nuovo ? 'Aggiungi' : 'Salva'}</button>
        ${nuovo ? '<button class="btn" type="button" id="maltro">Aggiungi e inserisci un altro</button>' : '<button class="btn danger" type="button" id="mdel">Elimina</button>'}
        ${m.daControllare ? '<span class="badge c">da controllare: salvando lo segni come visto</span>' : ''}
      </div>
    </form>`;
  const SPIEGA = {
    spesa: 'Soldi che escono e non tornano: spesa, bar, benzina, rate.',
    entrata: 'Soldi che arrivano da fuori: lavoro, regali, famiglia.',
    trasferimento: 'Sposti soldi tra due conti tuoi: <b>non è né spesa né entrata</b>. Esempi: prelievo al bancomat (Revolut → Contanti), soldi nel salvadanaio, investimenti.',
    rimborso: 'Ti ridanno soldi per una spesa (reso, amico che ti restituisce la sua parte). Abbassa le spese di quella categoria.',
  };
  apri(nuovo ? 'Nuovo movimento' : 'Modifica movimento', body, d => {
    const f = $('#mf', d);
    const sync = () => {
      d.querySelectorAll('[data-only]').forEach(el => el.hidden = !el.dataset.only.split(' ').includes(m.tipo));
      $('#lconto', d).firstChild.textContent = m.tipo === 'entrata' || m.tipo === 'rimborso' ? 'Su quale conto' : 'Da quale conto';
      $('#mspieg', d).innerHTML = SPIEGA[m.tipo];
      d.querySelectorAll('#mtipo button').forEach(b => b.classList.toggle('on', b.dataset.t === m.tipo));
    };
    sync();
    $('#mtipo', d).onclick = e => { const t = e.target.closest('[data-t]')?.dataset.t; if (t) { m.tipo = t; sync(); } };
    f.descr.oninput = () => { if (!f.categoria.value) { const c = indovinaCategoria(s, f.descr.value); if (c) f.categoria.value = c; } };
    const salva = altro => {
      const imp = round2(parseFloat(String(f.importo.value).replace(',', '.')));
      if (!(imp > 0)) { toast('Scrivi un importo maggiore di zero'); return; }
      if (m.tipo === 'trasferimento' && f.conto.value === f.contoDest.value) { toast('I due conti devono essere diversi'); return; }
      const out = { id: m.id, data: f.data.value, tipo: m.tipo, importo: imp, conto: f.conto.value, descr: f.descr.value.trim(), note: f.note.value.trim() };
      if (m.tipo === 'trasferimento') out.contoDest = f.contoDest.value;
      if (m.tipo === 'spesa' || m.tipo === 'rimborso') out.categoria = f.categoria.value || 'Regali e altro';
      if (m.tipo === 'entrata') out.lavoro = f.lavoro.checked;
      if (m.tipo === 'spesa') { if (f.nd.value) out.nd = f.nd.value; if (f.fissa.value) out.fissa = f.fissa.value === '1'; }
      modifica(st => { const i = st.movimenti.findIndex(x => x.id === m.id); if (i >= 0) st.movimenti[i] = out; else st.movimenti.push(out); });
      toast(nuovo ? 'Aggiunto' : 'Salvato');
      if (altro) formMovimento(null, { tipo: m.tipo, conto: out.conto, data: out.data }); else chiudi();
    };
    f.onsubmit = e => { e.preventDefault(); salva(false); };
    $('#maltro', d)?.addEventListener('click', () => salva(true));
    $('#mdel', d)?.addEventListener('click', () => { if (confirm('Eliminare questo movimento?')) { modifica(st => { st.movimenti = st.movimenti.filter(x => x.id !== m.id); }); chiudi(); toast('Eliminato'); } });
    setTimeout(() => f.importo.focus(), 30);
  });
}

// "Conta i contanti": scrivi quanti soldi hai davvero, il tool sistema la differenza
export function formContanti() {
  const s = state, cc = s.conti.find(c => c.tipo === 'contanti');
  if (!cc) { toast('Aggiungi prima un conto Contanti nelle impostazioni'); return; }
  const teorico = saldoAl(s, cc.id);
  apri('Conta i contanti', `
    <p class="kid">Apri il portafoglio e conta. Scrivi quanto c'è <b>davvero</b>.<br>Il tool confronta con quello che dovrebbe esserci e segna la differenza come <b>"Contanti non segnati"</b>, così il bilancio torna giusto anche se ti sei dimenticato qualche caffè.</p>
    <div class="rowsp"><span class="sub">Secondo il tool dovresti avere</span><span class="mid n">${eur(teorico)}</span></div>
    <form class="form" id="cf">
      <label class="f">Quanto hai in mano adesso (€)<input name="reale" type="number" step="0.01" min="0" inputmode="decimal" required></label>
      <p class="kid" id="cdiff"></p>
      <div class="btns"><button class="btn pri" type="submit">Sistema</button></div>
    </form>`, d => {
    const f = $('#cf', d), out = $('#cdiff', d);
    f.reale.oninput = () => {
      const r = parseFloat(f.reale.value); if (isNaN(r)) { out.textContent = ''; return; }
      const diff = round2(teorico - r);
      out.innerHTML = diff > 0 ? `Mancano <b>${eur(diff)}</b>: li segno come spesa "Contanti non segnati".` : diff < 0 ? `Hai <b>${eur(-diff)}</b> in più: li segno come entrata non da lavoro ("Contanti trovati").` : 'Torna tutto al centesimo. 👌';
    };
    f.onsubmit = e => {
      e.preventDefault();
      const r = round2(parseFloat(f.reale.value)), diff = round2(teorico - r);
      if (!diff) { chiudi(); toast('Contanti in ordine'); return; }
      modifica(st => st.movimenti.push(diff > 0
        ? { id: uid(), data: today(), tipo: 'spesa', categoria: 'Contanti non segnati', importo: diff, conto: cc.id, descr: 'Quadratura contanti' }
        : { id: uid(), data: today(), tipo: 'entrata', lavoro: false, importo: -diff, conto: cc.id, descr: 'Contanti trovati (quadratura)' }));
      chiudi(); toast('Contanti sistemati');
    };
    setTimeout(() => f.reale.focus(), 30);
  });
}

export { optConti, optCat, contoById };
