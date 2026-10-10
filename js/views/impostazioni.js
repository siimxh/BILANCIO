// Impostazioni: le tue regole, a slider, spiegate semplici. Più tasse, conti, categorie e backup.
import { $, esc, eur, eur0, icon, card, today, dataLunga, uid, round2, toast } from '../util.js';
import * as E from '../engine.js';
import { modifica, online, resetDemo, esci, sostituisci, email } from '../store.js';
import { TIPI_CONTO, normalize, daVecchio } from '../model.js';
import { apri, chiudi } from './forms.js';

// definizione degli slider: testo da bambino + esempio che cambia mentre muovi
const SLIDERS = [
  { k: 'cuscinetto', t: 'Cuscinetto minimo sul conto', min: 0, max: 2000, step: 10, fmt: v => eur0(v), cls: 'or',
    kid: 'Soldi che lasci <b>sempre</b> sul conto, come un materasso. Il tool li toglie da quello che puoi spendere. Quando guadagni di più, alzalo.',
    ex: (v, c) => `Hai ${eur0(c.saldo)} sul conto → puoi usarne ${eur0(Math.max(0, c.saldo - v))}. Gli altri ${eur0(Math.min(v, Math.max(c.saldo, 0)))} non si toccano.` },
  { k: 'risparmioPct', t: 'Quanto metti da parte', min: 0, max: 60, step: 1, fmt: v => v + '%',
    kid: 'Di ogni 100 € che entrano, quanti li metti via e fai finta di non averli. Da commercialista: almeno 20.',
    ex: (v, c) => c.entrate ? `Con le tue entrate medie (${eur0(c.entrate)} al mese) sono <b>${eur0(c.entrate * v / 100)}</b> al mese da spostare subito nei salvadanai.` : `Su 1.000 € che entrano, ne metti via ${eur0(10 * v)}.` },
  { k: 'budgetDesideri', t: 'Budget sfizi al mese', min: 0, max: 1000, step: 10, fmt: v => eur0(v),
    kid: 'Soldi per cose che vuoi ma non ti servono: uscite, vestiti, giochi, fumo. Finiti quelli, stop fino al mese dopo.',
    ex: (v, c) => `Questo mese ne hai già usati ${eur0(c.desideri)}: ${c.desideri > v ? `sei sopra di ${eur0(c.desideri - v)}.` : `ne restano ${eur0(v - c.desideri)}.`}` },
  { k: 'mesiAutonomiaTarget', t: 'Mesi di autonomia che vuoi', min: 1, max: 12, step: 1, fmt: v => v + (v === 1 ? ' mese' : ' mesi'), cls: 'cy',
    kid: 'Se domani smetti di guadagnare, per quanti mesi vuoi riuscire a pagare le cose essenziali (fisse e necessità)? I commercialisti dicono almeno 3.',
    ex: (v, c) => c.essenziali ? `Ti servono <b>${eur0(c.essenziali * v)}</b> da parte (${eur0(c.essenziali)} al mese × ${v}). Oggi reggi ${c.autonomia == null ? '—' : c.autonomia.toLocaleString('it-IT', { maximumFractionDigits: 1 })} mesi.` : 'Servono un po\' di spese registrate per calcolarlo.' },
  { k: 'mesiPrevisione', t: 'Su quanti mesi guardo il ritmo', min: 1, max: 12, step: 1, fmt: v => v + (v === 1 ? ' mese' : ' mesi'), cls: 'cy',
    kid: 'Le previsioni (dove arrivi a fine anno) guardano come sei andato negli ultimi mesi. Pochi mesi: reagisce subito. Tanti: più tranquillo.',
    ex: () => '' },
  { k: 'obiettivoPatrimonio', t: 'Dove vuoi arrivare a fine anno', min: 0, max: 30000, step: 100, fmt: v => v ? eur0(v) : 'nessun obiettivo', cls: 'cy',
    kid: 'Il patrimonio netto che vuoi avere al 31 dicembre. Il tool ti dice se a questo ritmo ci arrivi. Lascia 0 per non mettere obiettivi.',
    ex: (v, c) => v ? `Ora sei a ${eur0(c.patrimonio)}: ${v > c.patrimonio ? `mancano ${eur0(v - c.patrimonio)}.` : 'già superato.'}` : '' },
];

export function impostazioni(root, { s }) {
  const imp = s.impostazioni, oggi = today();
  const K = E.indicatori(s, oggi);
  const ctx = { saldo: K.oggi.saldoPr, entrate: K.disponibili, desideri: K.desideri.speso, essenziali: K.essenziali, autonomia: K.mesiAutonomia, patrimonio: E.patrimonio(s, oggi).netto };

  root.innerHTML = `
  <div class="hello"><div><h1>Impostazioni</h1><p>Le regole del tuo bilancio. Cambiale quando vuoi: tutto si ricalcola subito.</p></div></div>
  <div class="g">
    <section class="card s7">
      <div class="ch"><span class="ic">${icon.shield}</span><h3>Le tue regole</h3></div>
      <div>${SLIDERS.map(sl => {
        const v = +imp[sl.k] || 0, max = Math.max(sl.max, v);
        return `<div class="sl ${sl.cls || ''}" data-k="${sl.k}">
          <div class="top"><h4>${sl.t}</h4><span class="val n">${sl.fmt(v)}</span></div>
          <p class="kid">${sl.kid}</p>
          <input type="range" min="${sl.min}" max="${max}" step="${sl.step}" value="${v}" style="--p:${(v - sl.min) / (max - sl.min) * 100}%" aria-label="${sl.t}">
          <div class="scale"><span>${sl.fmt(sl.min)}</span><span>${sl.fmt(max)}</span></div>
          <div class="ex" ${sl.ex(v, ctx) ? '' : 'hidden'}>${sl.ex(v, ctx)}</div>
        </div>`; }).join('')}</div>
    </section>

    <div class="s5 stack">
      ${tasse(s)}
      ${card('Profilo', icon.flag, `<label class="f">Come ti chiamo<input id="pnome" value="${esc(s.profilo.nome || '')}"></label>
        ${online ? `<p class="kid">Account: <b>${esc(email())}</b></p><button class="btn ghost" id="logout">Esci</button>` : '<p class="kid">Sei in <b>modalità demo</b>: i dati sono inventati e restano solo su questo dispositivo.</p>'}`)}
    </div>

    <section class="card s7">
      <div class="ch"><span class="ic">${icon.cash}</span><h3>Conti</h3><button class="btn sm" style="margin-left:auto" id="addconto">＋ Aggiungi conto</button></div>
      <p class="kid">Ogni posto dove tieni soldi: conto, portafoglio, ogni salvadanaio Revolut, fondo tasse, investimenti. Il <b>saldo di partenza</b> è quanto c'era quel giorno, prima dei movimenti.</p>
      <div class="list">${E.saldi(s).map(c => `<div class="item" data-conto="${c.id}" style="cursor:pointer"><div><h4>${esc(c.nome)} ${c.principale ? '<span class="badge e">principale</span>' : ''}</h4><span class="meta">${esc(TIPI_CONTO[c.tipo])} · partenza ${eur(c.saldoIniziale)} il ${dataLunga(c.dataIniziale)}</span></div><span class="mid n" style="font-size:1.1rem">${eur(c.saldo)}</span></div>`).join('')}</div>
    </section>

    <section class="card s5">
      <div class="ch"><span class="ic">${icon.bars}</span><h3>Categorie</h3><button class="btn sm" style="margin-left:auto" id="addcat">＋</button></div>
      <p class="kid"><b>Necessità</b> = ti serve davvero. <b>Desiderio</b> = ne potresti fare a meno. <b>Fissa</b> = arriva uguale ogni mese.</p>
      <div class="list">${s.categorie.map((c, k) => `<div class="item" style="padding:10px 14px"><div style="min-width:0"><h4 style="font-size:.95rem">${esc(c.nome)}</h4></div>
        <div class="btns" style="flex-wrap:nowrap"><select data-cg="${k}" style="width:auto;padding:6px 8px;font-size:.82rem"><option value="necessita" ${c.gruppo === 'necessita' ? 'selected' : ''}>Necessità</option><option value="desiderio" ${c.gruppo === 'desiderio' ? 'selected' : ''}>Desiderio</option></select>
        <label class="chk" style="font-size:.8rem"><input type="checkbox" data-cf="${k}" ${c.fissa ? 'checked' : ''}>Fissa</label></div></div>`).join('')}</div>
      <details><summary class="kid" style="cursor:pointer">Regole automatiche (${s.regole.length})</summary>
        <p class="kid">Se la descrizione contiene questa parola, metto questa categoria. Valgono per i nuovi movimenti e gli import.</p>
        <div class="list">${s.regole.map(([kw, c], k) => `<div class="item" style="padding:8px 12px"><span>"${esc(kw)}" → ${esc(c)}</span><button class="btn sm ghost" data-rdel="${k}">✕</button></div>`).join('')}</div>
        <form class="fr" id="rf" style="margin-top:10px"><input name="kw" placeholder="parola, es. conad"><select name="cat">${s.categorie.map(c => `<option>${esc(c.nome)}</option>`).join('')}</select><button class="btn sm" type="submit">Aggiungi</button></form>
      </details>
    </section>

    <section class="card s12">
      <div class="ch"><span class="ic">${icon.shield}</span><h3>I tuoi dati</h3></div>
      <p class="kid">Scarica una copia di tutto ogni tanto. Puoi ricaricarla qui, anche su un altro account. Accetta anche il file del vecchio bilancio.</p>
      <div class="btns"><button class="btn" id="exp">↓ Scarica copia (JSON)</button><label class="btn" style="cursor:pointer">↑ Carica copia<input type="file" id="imp" accept=".json,application/json" hidden></label>${online ? '' : '<button class="btn ghost danger" id="reset">Ricomincia la demo</button>'}</div>
    </section>
  </div>`;

  // slider: si aggiornano mentre li muovi, salvano quando li lasci
  root.querySelectorAll('.sl').forEach(el => {
    const sl = SLIDERS.find(x => x.k === el.dataset.k), r = $('input', el);
    r.oninput = () => { const v = +r.value; r.style.setProperty('--p', (v - +r.min) / (+r.max - +r.min) * 100 + '%'); $('.val', el).textContent = sl.fmt(v); const ex = sl.ex(v, ctx), b = $('.ex', el); b.innerHTML = ex; b.hidden = !ex; };
    r.onchange = () => modifica(st => { st.impostazioni[sl.k] = +r.value; });
  });
  $('#pnome', root).onchange = e => modifica(st => { st.profilo.nome = e.target.value.trim(); });
  $('#logout', root)?.addEventListener('click', esci);
  $('#reset', root)?.addEventListener('click', () => { if (confirm('Rimettere i dati demo di partenza?')) resetDemo(); });
  $('#addconto', root).onclick = () => formConto(s);
  root.querySelectorAll('[data-conto]').forEach(el => el.onclick = () => formConto(s, s.conti.find(c => c.id === el.dataset.conto)));
  $('#addcat', root).onclick = () => { const n = prompt('Nome della nuova categoria'); if (n?.trim()) modifica(st => st.categorie.push({ nome: n.trim(), gruppo: 'desiderio', fissa: false })); };
  root.querySelectorAll('[data-cg]').forEach(el => el.onchange = () => modifica(st => { st.categorie[+el.dataset.cg].gruppo = el.value; }));
  root.querySelectorAll('[data-cf]').forEach(el => el.onchange = () => modifica(st => { st.categorie[+el.dataset.cf].fissa = el.checked; }));
  root.querySelectorAll('[data-rdel]').forEach(el => el.onclick = () => modifica(st => { st.regole.splice(+el.dataset.rdel, 1); }));
  $('#rf', root).onsubmit = e => { e.preventDefault(); const f = e.target; if (f.kw.value.trim()) modifica(st => st.regole.push([f.kw.value.trim(), f.cat.value])); };
  $('#exp', root).onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(s, null, 1)], { type: 'application/json' })); a.download = `bilancio-${today()}.json`; a.click(); };
  $('#imp', root).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const nuovo = j.movimenti && j.saldo_inizio ? daVecchio(j, s.profilo.nome) : normalize(j);
      if (confirm(`Sostituire tutti i dati con questo file (${nuovo.movimenti.length} movimenti)?`)) { sostituisci(nuovo); toast('Dati caricati'); }
    } catch (err) { toast('File non valido'); }
  };
  bindTasse(root, s);
}

// ---------------- tasse ----------------
function tasse(s) {
  const oggi = today(), att = E.regimeAl(s, oggi);
  return `<section class="card" id="tasse">
    <div class="ch"><span class="ic">${icon.tax}</span><h3>Tasse</h3></div>
    <p class="kid">Ogni regime vale <b>da una data in poi</b>. Il tool guarda il giorno di ogni incasso da lavoro e mette via la percentuale giusta.</p>
    ${s.impostazioni.regimi.map((r, k) => {
      const stima = E.stimaForfettario(r), attivo = r.id === att.id;
      return `<div class="item" style="display:grid;grid-template-columns:1fr;gap:12px" data-reg="${k}">
        <div class="rowsp"><h4>${k === 0 ? 'Fino a' : 'Dal'} ${k === 0 ? (s.impostazioni.regimi[1] ? dataLunga(s.impostazioni.regimi[1].dal) : 'sempre') : dataLunga(r.dal)}</h4>${attivo ? '<span class="st ok">adesso</span>' : '<span class="st neu">in futuro</span>'}</div>
        <div class="fr">
          ${k === 0 ? '' : `<label class="f">Dal giorno<input type="date" data-f="dal" value="${r.dal}"></label>`}
          <label class="f">Situazione<select data-f="tipo"><option value="nessuna" ${r.tipo === 'nessuna' ? 'selected' : ''}>Niente P.IVA (incassi già netti)</option><option value="forfettario" ${r.tipo === 'forfettario' ? 'selected' : ''}>P.IVA forfettaria</option><option value="altro" ${r.tipo === 'altro' ? 'selected' : ''}>Altro (scelgo io la %)</option></select></label>
        </div>
        ${r.tipo === 'nessuna' ? '<p class="kid">Quello che incassi è già tuo: <b>0% da mettere via</b>.</p>' : `
        <div class="sl or" data-rk="pct"><div class="top"><h4>Da mettere via per le tasse</h4><span class="val n">${r.pct}%</span></div>
          <p class="kid">Di ogni 100 € che incassi, quanti finiscono nel salvadanaio tasse e non li tocchi.</p>
          <input type="range" min="0" max="50" step="1" value="${r.pct}" style="--p:${r.pct * 2}%" aria-label="Percentuale tasse"></div>
        ${r.tipo === 'forfettario' ? `
        <div class="fr">
          <label class="f">Coefficiente %<input type="number" data-f="coeff" value="${r.coeff ?? 62}" min="1" max="100"></label>
          <label class="f">Imposta<select data-f="imposta"><option value="5" ${+r.imposta === 5 ? 'selected' : ''}>5% (primi 5 anni)</option><option value="15" ${+r.imposta === 15 ? 'selected' : ''}>15%</option></select></label>
          <label class="f">Contributi %<input type="number" data-f="contributi" value="${r.contributi ?? 26}" min="0" max="40" step="0.1"></label>
        </div>
        <p class="kid">Stima da manuale con questi numeri: <b>${Math.round(stima * 1000) / 10}%</b> di ogni incasso. ${r.pct < stima * 100 ? '<span class="neg">Stai mettendo via meno della stima.</span>' : 'Sei sopra la stima: margine per imprevisti e Enasarco.'} <button class="btn sm" type="button" data-usa="${Math.ceil(stima * 100)}">Usa ${Math.ceil(stima * 100)}%</button></p>
        <p class="kid muted">Agente di commercio: coefficiente 62%. I contributi (INPS commercianti o gestione separata, più Enasarco) li conferma il commercialista: finché non li sai, 25–30% è prudente.</p>` : ''}`}
        ${k > 0 ? '<button class="btn sm ghost danger" type="button" data-rdel>Elimina questo periodo</button>' : ''}
      </div>`; }).join('')}
    <button class="btn sm" type="button" id="addreg">＋ Cambia regime da una data</button>
  </section>`;
}
function bindTasse(root, s) {
  root.querySelectorAll('[data-reg]').forEach(el => {
    const k = +el.dataset.reg, set = (f, v) => modifica(st => { st.impostazioni.regimi[k][f] = v; });
    el.querySelectorAll('[data-f]').forEach(i => i.onchange = () => set(i.dataset.f, i.type === 'number' || i.dataset.f === 'imposta' ? +i.value : i.value));
    const r = $('[data-rk] input', el);
    if (r) { r.oninput = () => { r.style.setProperty('--p', r.value * 2 + '%'); $('[data-rk] .val', el).textContent = r.value + '%'; }; r.onchange = () => set('pct', +r.value); }
    $('[data-usa]', el)?.addEventListener('click', e => set('pct', +e.target.dataset.usa));
    $('[data-rdel]', el)?.addEventListener('click', () => { if (confirm('Eliminare questo periodo?')) modifica(st => { st.impostazioni.regimi.splice(k, 1); }); });
  });
  $('#addreg', root).onclick = () => modifica(st => { const last = st.impostazioni.regimi.at(-1); const d = last.dal > today() ? last.dal : today(); st.impostazioni.regimi.push({ id: uid(), dal: `${+d.slice(0, 4) + 1}-01-01`, tipo: 'forfettario', pct: 25, coeff: 62, imposta: 5, contributi: 26 }); });
}

// ---------------- conti ----------------
function formConto(s, c = null) {
  const nuovo = !c; c = c ? { ...c } : { id: uid(), tipo: 'risparmio', saldoIniziale: 0, dataIniziale: today() };
  const usato = !nuovo && s.movimenti.some(m => m.conto === c.id || m.contoDest === c.id);
  apri(nuovo ? 'Nuovo conto' : 'Modifica conto', `<form class="form" id="cf">
    <div class="fr"><label class="f">Nome<input name="nome" required value="${esc(c.nome || '')}" placeholder="es. Salvadanaio patente"></label>
      <label class="f">Tipo<select name="tipo">${Object.entries(TIPI_CONTO).map(([k, t]) => `<option value="${k}" ${c.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
    <div class="fr"><label class="f">Saldo di partenza (€)<input name="saldo" type="number" step="0.01" value="${c.saldoIniziale}"></label>
      <label class="f">Quel giorno<input name="data" type="date" value="${c.dataIniziale}"></label></div>
    <p class="kid">Trucco: metti il saldo di <b>oggi</b> con la data di oggi. I movimenti vecchi vengono contati all'indietro da soli.</p>
    <label class="chk"><input type="checkbox" name="pr" ${c.principale ? 'checked' : ''}> È il conto principale (quello del cuscinetto e del "puoi spendere oggi")</label>
    <div class="btns"><button class="btn pri" type="submit">Salva</button>${nuovo ? '' : `<button class="btn danger" type="button" id="cdel" ${usato ? 'disabled title="Ha dei movimenti: non si può eliminare"' : ''}>Elimina</button>`}</div>
  </form>`, d => {
    const f = $('#cf', d);
    f.onsubmit = e => {
      e.preventDefault();
      const out = { ...c, nome: f.nome.value.trim(), tipo: f.tipo.value, saldoIniziale: round2(+f.saldo.value || 0), dataIniziale: f.data.value || today(), principale: f.pr.checked };
      modifica(st => { if (out.principale) st.conti.forEach(x => x.principale = false); const k = st.conti.findIndex(x => x.id === c.id); if (k >= 0) st.conti[k] = out; else st.conti.push(out); });
      chiudi(); toast('Salvato');
    };
    $('#cdel', d)?.addEventListener('click', () => { if (confirm('Eliminare il conto?')) { modifica(st => { st.conti = st.conti.filter(x => x.id !== c.id); }); chiudi(); } });
  });
}
