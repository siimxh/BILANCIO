// Dashboard: il conto economico del periodo scelto + i numeri che servono per decidere.
import { $, esc, eur, eur0, big, pct, icon, card, today, dataLunga, dataBreve, daysBetween, addDays, MESI, MESI3, parse, cap, monthEnd, round2 } from '../util.js';
import * as E from '../engine.js';
import * as C from '../charts.js';
import { state, online, saving } from '../store.js';
import { formMovimento, formContanti } from './forms.js';

export function dashboard(root, { s, per, vai, mobile }) {
  const st = E.stats(s, per), pv = E.stats(s, E.prima(per)), imp = s.impostazioni;
  const oggi = today(), inCorso = per.start <= oggi && per.end >= oggi;
  const fine = inCorso ? oggi : per.end < oggi ? per.end : per.start;
  const pr = E.principale(s), saldoPr = E.saldoAl(s, pr.id, fine);
  const K = E.indicatori(s, oggi);
  const nfix = E.daSistemare(s).length;
  const nome = s.profilo.nome || 'ciao';
  const ora = new Date().getHours(), saluto = ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const delta = (a, b, inv) => { if (!b) return ''; const d = (a - b) / Math.abs(b); const good = inv ? d <= 0 : d >= 0; return `<span class="delta ${good ? 'pos' : 'neg'}">${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d * 100))}% vs ${esc(E.etichettaBreve(E.prima(per)))}</span>`; };

  // budget spese del periodo: quello che entra meno la quota da mettere da parte
  const budget = st.disponibili > 0 ? round2(st.disponibili * (1 - imp.risparmioPct / 100)) : 0;
  const prossimo = E.pagamenti(s, oggi, addDays(oggi, 400))[0];
  const P = E.pacing(s, oggi);
  const obs = s.obiettivi.map(o => E.obiettivo(s, o, oggi));
  const top = obs.find(o => !o.fatto) || obs[0];
  const quoteMese = round2(obs.filter(o => !o.fatto).reduce((a, o) => a + o.quota, 0));
  const cc = s.conti.find(c => c.tipo === 'contanti'), saldoCC = cc ? E.saldoAl(s, cc.id, fine) : 0;
  const reg = E.regimeAl(s, oggi), regFuturo = s.impostazioni.regimi.find(r => r.dal > oggi);
  const tx = K.tasse;
  const ultimiMesi = E.perMese(s, E.periodo('mese', addDays(oggi, -230)).start, oggi).slice(-8);

  root.innerHTML = `
  <div class="hello">
    <div><h1>${saluto}, ${esc(nome)}</h1><p>${inCorso ? `Ecco com'è ${per.modo === 'mese' ? 'questo mese' : 'questo periodo'} fino a oggi.` : `Ecco com'è andato: ${esc(E.etichetta(per)).toLowerCase()}.`}</p></div>
    <div class="btns">${online ? '' : '<span class="tag demo">Modalità demo · dati inventati</span>'}<span class="tag" data-saving>${saving}</span></div>
  </div>

  <div class="g dash">
    ${nfix ? `<div class="alert s12" data-mob style="--o:0" data-go="movimenti"><span class="blink"></span><span>${nfix} ${nfix === 1 ? 'movimento da sistemare' : 'movimenti da sistemare'}: nomi della banca che non riconosco</span><span class="go">Sistema ↗</span></div>` : ''}
    <section class="card s3 c-saldo" data-mob style="--o:1">
      <div class="top"><span>CONTO PRINCIPALE</span><span>${esc(pr.nome)}</span></div>
      <div><div class="sub" style="color:#C9D6F2">${inCorso ? 'Saldo di oggi' : 'Saldo a fine periodo'}</div><div class="big n">${big(saldoPr)}</div>
        <div class="sub" style="color:#C9D6F2;margin-top:6px">di cui <b class="n">${eur0(imp.cuscinetto)}</b> di cuscinetto: non si toccano</div></div>
      <div class="acts"><button data-act="nuovo">＋ Nuovo</button><button data-act="importa">↑ Importa</button><button data-act="apri">↗ Apri</button></div>
    </section>

    <section class="card s3" data-mob style="--o:2;background:radial-gradient(90% 80% at 50% 0%, rgba(57,198,224,.16), transparent 60%), linear-gradient(180deg,#132226,#111719);border-color:rgba(57,198,224,.2)">
      <div class="ch"><span class="ic">${icon.cash}</span><h3>Oggi puoi spendere</h3></div>
      <div class="big n" style="font-size:2.6rem">${big(K.oggi.perGiorno)}</div>
      <p class="kid">al giorno fino a fine mese (${K.oggi.giorniRim} giorni). In tutto <b class="n">${eur(Math.max(0, K.oggi.spendibile))}</b>.</p>
      <p class="kid" data-tip="Saldo ${eur(K.oggi.saldoPr)}\n− cuscinetto ${eur(K.oggi.cuscinetto)}\n− pagamenti in arrivo ${eur(K.oggi.daPagare)}\n− salvadanai da riempire ${eur(K.oggi.quoteMancanti)}\n− tasse da mettere via ${eur(K.oggi.tasseMese)}\n= ${eur(K.oggi.spendibile)}">Come lo calcolo? <u>passa qui sopra</u></p>
    </section>

    <section class="card s3 c-pay" data-mob style="--o:3">
      <div class="ch"><h3>Prossimo pagamento</h3><span class="go" data-go="impegni" style="cursor:pointer">↗</span></div>
      ${prossimo ? `<div style="display:grid;gap:4px;margin-top:auto">
        <div class="big n">${big(prossimo.importo)}</div>
        <strong style="font-size:1.05rem">${esc(prossimo.imp.nome)}</strong>
        <span class="sub" style="color:#F2C9B8">${dataLunga(prossimo.data)} · ${(() => { const g = daysBetween(oggi, prossimo.data); return g === 0 ? 'oggi' : g === 1 ? 'domani' : `tra ${g} giorni`; })()}</span>
      </div>` : '<p class="kid" style="color:#F2C9B8">Nessun pagamento in programma. Aggiungi rate e abbonamenti in Impegni.</p>'}
    </section>

    <section class="card s3 c-gauge" data-mob style="--o:5">
      <div class="ch"><h3>Spese del periodo</h3></div>
      ${C.gauge(budget ? st.spese / budget : 0, budget ? undefined : '—')}
      <div style="display:grid;gap:2px">
        <span class="sub" style="color:#C8E6B6">${budget ? `su un tetto di ${eur0(budget)} (entrate meno il ${imp.risparmioPct}% da mettere via)` : 'nessuna entrata nel periodo: tetto non calcolabile'}</span>
        <div class="big n" style="font-size:2rem">${big(st.spese)}</div>
      </div>
    </section>

    <section class="card s4" data-mob style="--o:6">
      <div class="ch"><span class="ic">${icon.bars}</span><h3>Conto economico</h3><span class="pillsm">${esc(E.etichetta(per))}</span></div>
      <div class="ce">
        <div class="r"><span class="op"></span><span>Incassato da lavoro</span><span class="v n">${eur(st.entLavoro)}</span></div>
        <div class="r"><span class="op">−</span><span>Tasse da mettere via<small>${st.tasse ? '' : 'Niente: senza P.IVA incassi già netti'}</small></span><span class="v n">${eur(st.tasse)}</span></div>
        <div class="r"><span class="op">+</span><span>Altre entrate<small>regali, famiglia: non sono lavoro</small></span><span class="v n">${eur(st.entAltre)}</span></div>
        <div class="r"><span class="op">−</span><span>Spese fisse</span><span class="v n">${eur(st.fisse)}</span></div>
        <div class="r"><span class="op">−</span><span>Necessità variabili</span><span class="v n">${eur(st.necessita)}</span></div>
        <div class="r"><span class="op">−</span><span>Desideri</span><span class="v n">${eur(st.desideri)}</span></div>
        <div class="r tot"><span class="op">=</span><span>Saldo del periodo<small>${st.saldo >= 0 ? 'ti sono avanzati' : 'hai speso più di quanto è entrato'}</small></span><span class="v n ${st.saldo >= 0 ? 'pos' : 'neg'}">${eur(st.saldo)}</span></div>
      </div>
      <div class="rowsp"><span class="sub">Tasso di risparmio</span><span class="st ${E.voto.risparmio(st.tassoRisparmio)}">${E.fmtRisp(st.tassoRisparmio)}</span></div>
    </section>

    <section class="card s8" data-mob style="--o:7">
      <div class="ch"><span class="ic">${icon.line}</span><h3>Corsa della spesa</h3><span class="pillsm">${esc(E.etichettaBreve(per))} contro ${esc(E.etichettaBreve(E.prima(per)))}</span></div>
      <div class="lg"><span><i style="background:var(--mag)"></i>${esc(cap(E.etichettaBreve(per)))}</span><span><i style="background:var(--cyan)"></i>${esc(cap(E.etichettaBreve(E.prima(per))))}</span>${budget ? '<span><i style="background:#F2F1F6"></i>Tetto</span>' : ''}</div>
      <svg id="race" aria-label="Spese cumulate"></svg>
    </section>

    ${kpi('Tasso di risparmio', icon.flag, E.fmtRisp(K.tassoRisparmio), K.tassoRisparmio, .2, E.voto.risparmio(K.tassoRisparmio), 'Quanto ti avanza di quello che entra. Obiettivo: almeno il 20%.', 'linear-gradient(90deg,#1E5BD8,#3BA0FF)', 8)}
    ${kpi('Peso delle spese fisse', icon.bars, pct(K.pesoFisse), K.pesoFisse, .5, E.voto.fisse(K.pesoFisse), 'Quanto delle entrate se ne va in cose fisse. Meglio sotto il 50%.', 'linear-gradient(90deg,#6B2FBF,#C04BE0)', 9)}
    ${kpi('Peso dei debiti', icon.minus, pct(K.pesoDebiti), K.pesoDebiti, .3, E.voto.debiti(K.pesoDebiti), `Rate al mese: ${eur(K.rate)}. Sopra il 30–35% delle entrate è troppo.`, 'linear-gradient(90deg,#D9502A,#FF7A3D)', 10)}
    ${kpi('Mesi di autonomia', icon.clock, K.mesiAutonomia == null ? '—' : K.mesiAutonomia.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' mesi', K.mesiAutonomia == null ? 0 : K.mesiAutonomia / Math.max(imp.mesiAutonomiaTarget * 1.5, 1), imp.mesiAutonomiaTarget / Math.max(imp.mesiAutonomiaTarget * 1.5, 1), E.voto.autonomia(K.mesiAutonomia, imp.mesiAutonomiaTarget), `Quanto reggi senza entrate pagando solo l'essenziale (${eur0(K.essenziali)}/mese). Obiettivo: ${imp.mesiAutonomiaTarget}.`, 'linear-gradient(90deg,#2E9C8A,#4ADE9B)', 11)}
    <p class="kid s12" style="margin-top:-4px">Questi quattro numeri usano la media degli ultimi ${K.mesiBase} ${K.mesiBase === 1 ? 'mese' : 'mesi'} chiusi, non solo il periodo scelto.</p>

    <section class="card s7">
      <div class="ch"><span class="ic">${icon.flow}</span><h3>Flusso dei soldi</h3><span class="go" data-go="movimenti" style="cursor:pointer">↗</span></div>
      ${C.flow(flussoIn(st), flussoOut(st))}
    </section>

    <section class="card s5" data-mob style="--o:12">
      <div class="ch"><span class="ic">${icon.bars}</span><h3>Spese per categoria</h3><span class="go" data-go="movimenti" style="cursor:pointer">↗</span></div>
      ${C.cats(st.cats.slice(0, 8), st.spese)}
    </section>

    <div class="s4 stack">
      <section class="card">
        <div class="ch"><span class="ic">${icon.plus}</span><h3>Entrate</h3></div>
        <div class="rowsp"><div class="big n" style="font-size:2rem">${big(st.disponibili)}</div>${delta(st.disponibili, pv.disponibili)}</div>
        ${C.pbar(Math.max(st.disponibili, st.spese) ? st.disponibili / Math.max(st.disponibili, st.spese) : 0)}
      </section>
      <section class="card">
        <div class="ch"><span class="ic">${icon.minus}</span><h3>Spese</h3></div>
        <div class="rowsp"><div class="big n" style="font-size:2rem">${big(st.spese)}</div>${delta(st.spese, pv.spese, true)}</div>
        ${C.pbar(Math.max(st.disponibili, st.spese) ? st.spese / Math.max(st.disponibili, st.spese) : 0, 'linear-gradient(90deg,#6B2FBF,#C04BE0)')}
      </section>
      <section class="card">
        <div class="ch"><h3>Necessità e desideri</h3></div>
        ${ndBar(st)}
        <p class="kid">Sfizi questo mese: <b class="n">${eur(K.desideri.speso)}</b> su un budget di <b class="n">${eur0(K.desideri.budget)}</b>${K.desideri.speso > K.desideri.budget ? ' · <span class="neg">sforato</span>' : ''}.</p>
      </section>
    </div>

    <section class="card s8" data-mob style="--o:14">
      <div class="ch"><span class="ic">${icon.line}</span><h3>Dove arrivi: patrimonio</h3><span class="go" data-go="patrimonio" style="cursor:pointer">↗</span></div>
      ${pacingBlock(P, mobile)}
    </section>

    ${top ? `<section class="card s3" data-mob style="--o:13">
      <div class="ch"><h3>${esc(top.nome)}</h3><span class="go" data-go="obiettivi" style="cursor:pointer">↗</span></div>
      <div style="display:grid;grid-template-columns:1fr 110px;align-items:center;gap:10px">
        <div><div class="sub">Messi da parte</div><div class="big n" style="font-size:2rem">${big(top.messo, 0)}</div><div class="sub">di ${eur0(top.target)}</div></div>
        ${C.ring(top.prog)}
      </div>
      <span class="st ${top.stato}">${top.fatto ? 'Fatto' : top.stato === 'ok' ? 'In linea' : top.stato === 'neu' ? 'Senza scadenza' : 'In ritardo'}</span>
      <span class="sub">${top.fatto ? 'Obiettivo raggiunto.' : top.quota ? `Servono ${eur0(top.quota)} al mese per ${top.mesiRim} ${top.mesiRim === 1 ? 'mese' : 'mesi'}.` : ''}</span>
    </section>` : `<section class="card s3"><div class="ch"><h3>Obiettivi</h3></div><p class="kid">Nessun obiettivo ancora.</p><button class="btn" data-go="obiettivi">Aggiungine uno</button></section>`}

    <section class="card s3" style="background:radial-gradient(90% 80% at 50% 0%, rgba(255,122,61,.14), transparent 60%), linear-gradient(180deg,#22181A,#161113);border-color:rgba(255,122,61,.2)">
      <div class="ch"><h3>Da mettere via questo mese</h3></div>
      <div style="text-align:center"><div class="muted" style="font-size:.75rem;letter-spacing:.1em">PER I TUOI OBIETTIVI</div><div class="big n" style="justify-content:center;font-size:2.4rem">${big(quoteMese, 0)}</div></div>
      ${C.ruler(quoteMese, Math.max(300, quoteMese * 1.3))}
      <p class="kid" style="text-align:center">Prima paghi te stesso: appena entrano i soldi, sposta questa cifra nei salvadanai.</p>
    </section>

    <section class="card s3 c-seg" data-mob style="--o:4">
      <div class="ch"><h3>Quanto hai usato</h3></div>
      ${C.segs(st.disponibili ? st.spese / st.disponibili : (st.spese ? 1 : 0))}
      <span class="sub" style="color:#F2C1C8">Spesi <b class="n" style="color:var(--fg)">${eur(st.spese)}</b> su <span class="n">${eur(st.disponibili)}</span> entrati</span>
    </section>

    <section class="card s3">
      <p class="sent" style="margin:0">${frase(st, pv, per)}</p>
      ${C.spark(ultimiMesi.map(m => m.spese), ultimiMesi.map(m => MESI3[parse(m.mese).getMonth()]))}
      <span class="sub">Spese mese per mese</span>
    </section>

    <section class="card s4" data-mob style="--o:15">
      <div class="ch"><span class="ic">${icon.cash}</span><h3>Contanti</h3></div>
      <div class="rowsp"><div class="big n" style="font-size:2rem">${big(saldoCC)}</div><span class="sub">nel portafoglio</span></div>
      <p class="kid">Prelevati nel periodo: <b class="n">${eur(st.prelievi)}</b>. Un prelievo <b>non è una spesa</b>: sposti soldi dal conto al portafoglio. La spesa la segni quando li usi.</p>
      <div class="btns"><button class="btn" data-act="spesacontanti">＋ Spesa in contanti</button><button class="btn ghost" data-act="conta">Conta i contanti</button></div>
    </section>

    <section class="card s4">
      <div class="ch"><span class="ic">${icon.tax}</span><h3>Tasse</h3><span class="go" data-go="impostazioni" style="cursor:pointer">↗</span></div>
      ${reg.tipo === 'nessuna'
        ? `<div class="mid">Niente da mettere via</div><p class="kid">Ora non hai la P.IVA: quello che incassi è già netto.${regFuturo ? ` Dal <b>${dataLunga(regFuturo.dal)}</b> passi al ${regFuturo.tipo}: da lì il tool mette via il <b>${regFuturo.pct}%</b> di ogni incasso.` : ''}</p>`
        : `<div class="rowsp"><div class="mid n">${eur(tx.accantonato)}</div><span class="sub">messi via su ${eur(tx.daPagare)} da pagare</span></div>${C.pbar(tx.daPagare ? tx.accantonato / tx.daPagare : 1, 'linear-gradient(90deg,#2E9C8A,#4ADE9B)', 22)}<p class="kid">${tx.manca ? `Mancano <b>${eur(tx.manca)}</b> nel salvadanaio tasse.` : 'Sei coperto.'} Regime: ${reg.tipo}, ${reg.pct}% di ogni incasso.</p>`}
    </section>

    <section class="card s4 c-ai">
      <div class="ch"><h3>Chiedi al tuo bilancio</h3><span class="tag" style="margin-left:auto">in arrivo</span></div>
      <p>Quanto posso spendere <span>questo weekend senza…</span></p>
      <div class="mic"><svg viewBox="0 0 16 16" style="width:18px"><rect x="6" y="2" width="4" height="8" rx="2" fill="#fff"/><path d="M4 8a4 4 0 0 0 8 0M8 12v2" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg></div>
    </section>
  </div>
  <p class="foot">Spostamenti tra i tuoi conti, prelievi e versamenti nei salvadanai non contano come spese. Passa il mouse sui grafici per i dettagli.</p>`;

  // corsa della spesa
  const A = st.cum.map((v, i) => (inCorso && addDays(per.start, i) > oggi) ? null : round2(v));
  const B = pv.cum.map(round2);
  const n = Math.max(A.length, B.length);
  const lab = Array.from({ length: n }, (_, i) => dataBreve(addDays(per.start, i)));
  const series = [{ nome: cap(E.etichettaBreve(per)), valori: pad(A, n), area: true, colore: '#C04BE0', punto: '#E07BFF' }, { nome: cap(E.etichettaBreve(E.prima(per))), valori: pad(B, n), colore: '#3BA0FF' }];
  if (budget) series.push({ nome: 'Tetto', valori: Array(n).fill(budget), colore: 'rgba(242,241,246,.5)', tratteggio: true });
  C.lines($('#race', root), { series, labels: lab, tipLabel: i => `Fino al ${lab[i]}`, ...(mobile ? { W: 420, H: 300 } : {}) });


  root.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'nuovo') formMovimento();
    if (a === 'importa') vai('movimenti/importa');
    if (a === 'apri') vai('movimenti');
    if (a === 'conta') formContanti();
    if (a === 'spesacontanti') formMovimento(null, { tipo: 'spesa', conto: cc?.id });
  });
  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => vai(b.dataset.go));
}

const pad = (a, n) => a.concat(Array(Math.max(0, n - a.length)).fill(null));

function kpi(t, ic, val, p, target, stato, txt, grad, o) {
  return `<section class="card s3 kpi half" data-mob style="--o:${o}"><div class="ch"><span class="ic">${ic}</span><h3>${t}</h3></div>
    <div class="rowsp"><span class="mid n">${val}</span><span class="st ${stato}">${E.VOTO_TXT[stato]}</span></div>
    ${C.minibar(Math.max(0, p || 0), grad, target)}
    <p class="kid">${txt}</p></section>`;
}

function ndBar(st) {
  const n = st.fisse + st.necessita, d = st.desideri, t = n + d;
  if (t <= 0) return '<p class="empty">Nessuna spesa.</p>';
  return `<div class="pbar" style="height:22px"><div class="f" style="width:${n / t * 100}%;background:linear-gradient(90deg,#1E5BD8,#3BA0FF)"></div><div class="f" style="flex:1;background:linear-gradient(90deg,#8E3BD6,#C04BE0)"></div></div>
  <div class="lg"><span><i style="background:var(--cyan)"></i>Necessità ${Math.round(n / t * 100)}% · ${eur0(n)}</span><span><i style="background:var(--mag)"></i>Desideri ${Math.round(d / t * 100)}% · ${eur0(d)}</span></div>`;
}

function flussoIn(st) {
  const r = [];
  if (st.netto > 0) r.push(['Lavoro', st.netto, '#3BA0FF']);
  if (st.entAltre > 0) r.push(['Altre entrate', st.entAltre, '#39C6E0']);
  const gap = st.spese - st.disponibili;
  if (gap > 0) r.push(['Dal saldo', gap, '#5A5770']);
  return r;
}
function flussoOut(st) {
  const r = st.cats.filter(([, v]) => v > 0).slice(0, 6);
  const altro = st.cats.filter(([, v]) => v > 0).slice(6).reduce((a, [, v]) => a + v, 0);
  if (altro > 0) r.push(['Altro', altro]);
  if (st.saldo > 0) r.push(['Messo da parte', st.saldo]);
  return r;
}

function frase(st, pv, per) {
  const lbl = E.etichettaBreve(per), prev = E.etichettaBreve(E.prima(per));
  if (!pv.spese) return `In ${esc(lbl)} hai speso <span style="color:#E3A6F5">${eur0(st.spese)}</span>.`;
  const d = (st.spese - pv.spese) / pv.spese;
  if (Math.abs(d) < .03) return `Spese in linea con ${esc(prev)}.`;
  return d > 0 ? `Hai speso il <span style="color:#FF9AA6">${Math.round(d * 100)}% in più</span> di ${esc(prev)}.` : `Hai speso il <span style="color:#7FE8B7">${Math.round(-d * 100)}% in meno</span> di ${esc(prev)}.`;
}

const nomiModi = m => m.length === 1 ? m[0] : m.slice(0, -1).join(', ') + ' e ' + m[m.length - 1];
function pacingTiles(P) {
  if (P.uniti.length === 1) return `<p class="kid">Trimestre, semestre e anno finiscono tutti il 31 dicembre. La previsione porta avanti il ritmo medio degli ultimi ${P.N} mesi.</p>`;
  return `<div class="g" style="gap:12px">${P.uniti.map(t => {
    const good = P.target && t.modi.includes('anno') ? (t.stima >= P.target ? 'ok' : 'warn') : null;
    return `<div class="s${12 / P.uniti.length}" style="background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:16px;padding:12px 14px;display:grid;gap:4px">
      <span class="k">Fine ${nomiModi(t.modi)}</span><span class="mid n">${big(t.stima, 0)}</span>
      <span class="sub">${good ? `<span class="st ${good}">${good === 'ok' ? 'Ci arrivi' : `Ti mancano ${eur0(P.target - t.stima)}`}</span>` : `${P.media >= 0 ? '+' : ''}${eur0(P.media)} al mese`}</span></div>`;
  }).join('')}</div><p class="kid">Previsione: ritmo medio degli ultimi ${P.N} mesi (${P.media >= 0 ? '+' : ''}${eur0(P.media)} al mese) portato avanti fino a fine anno.</p>`;
}

// blocco pacing: frase chiara + barre mese per mese (passato pieno, futuro a righe) + traguardi
export function pacingBlock(P, mobile) {
  const serie = P.serie; if (!serie.length) return '<p class="empty">Servono un po\' di movimenti per la previsione.</p>';
  const anno = P.traguardi[2].fine, y = anno.slice(0, 4), last = serie[serie.length - 1];
  const mesi = serie.filter(x => x.mese >= y + '-01-01').map((x, i, a) => ({ label: MESI3[parse(x.mese).getMonth()], v: x.netto, tipo: i === a.length - 1 ? 'oggi' : 'passato',
    tip: `${cap(MESI[parse(x.mese).getMonth()])}: ${eur(x.netto)}${i === a.length - 1 ? ' (oggi)' : ' a fine mese'}` }));
  let m = last.mese;
  while (true) { const d = parse(m); d.setMonth(d.getMonth() + 1); const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; if (ms > anno) break;
    const v = round2(last.netto + P.media * daysBetween(last.data, monthEnd(ms)) / 30.44);
    mesi.push({ label: MESI3[d.getMonth()], v, tipo: 'futuro', tip: `${cap(MESI[d.getMonth()])}: circa ${eur(v)} (previsione)` }); m = ms; }
  const fine = P.traguardi[2].stima, diff = P.target ? fine - P.target : 0;
  const vis = mobile ? mesi.slice(-7) : mesi;
  return `<div class="pace-head">
      <div><div class="k">Al 31 dicembre, a questo ritmo</div><div class="big n">${big(fine, 0)}</div></div>
      <div class="pace-facts">
        <span>Oggi hai <b class="n">${eur0(P.ora)}</b></span>
        <span>Ritmo: <b class="n ${P.media >= 0 ? 'pos' : 'neg'}">${P.media >= 0 ? '+' : ''}${eur0(P.media)} al mese</b></span>
        ${P.target ? `<span class="st ${diff >= 0 ? 'ok' : 'warn'}">${diff >= 0 ? `Obiettivo ${eur0(P.target)}: ci arrivi con ${eur0(diff)} di margine` : `Obiettivo ${eur0(P.target)}: ti mancano ${eur0(-diff)}`}</span>` : ''}
      </div></div>
    <div class="lg"><span><i style="background:var(--mag)"></i>Com'è andata (fine mese)</span><span><i style="background:repeating-linear-gradient(45deg,#3BA0FF 0 2px,transparent 2px 4px);border:1px solid #3BA0FF"></i>Previsione</span>${P.target ? '<span><i style="background:#FF7A3D"></i>Obiettivo</span>' : ''}</div>
    ${C.barrePacing(vis, { target: P.target, W: mobile ? 420 : 820, H: mobile ? 300 : 280 })}
    ${pacingTiles(P)}`;
}
