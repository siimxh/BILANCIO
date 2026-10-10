// Il "commercialista": tutti i calcoli stanno qui, le schermate li mostrano e basta.
//
// Regole di base:
// - Spostamenti tra i tuoi conti (prelievo al bancomat, versamento nel salvadanaio, investimenti) NON sono spese né entrate.
// - I rimborsi abbassano le spese della loro categoria, non sono entrate.
// - Le entrate "non da lavoro" (regali, soldi di famiglia) si contano a parte e non pagano tasse.
// - Le tasse da accantonare dipendono dal regime in vigore il giorno dell'incasso (fino al 2027: zero, incassi già netti).
import { parse, iso, addDays, addMonths, daysBetween, monthStart, monthEnd, monthsBetween, today, round2, MESI, MESI3, cap } from './util.js';

// ====================== periodi ======================
export const MODI = { mese: 'Mese', trimestre: 'Trimestre', semestre: 'Semestre', anno: 'Anno', custom: 'Date a scelta' };

export function periodo(modo, ref = today()) {
  const d = parse(ref), y = d.getFullYear(), m = d.getMonth();
  const span = { mese: 1, trimestre: 3, semestre: 6, anno: 12 }[modo] || 1;
  const m0 = Math.floor(m / span) * span;
  return { modo, start: iso(new Date(y, m0, 1)), end: iso(new Date(y, m0 + span, 0)) };
}
export function sposta(p, dir) {
  if (p.modo === 'custom') { const len = daysBetween(p.start, p.end) + 1; return { ...p, start: addDays(p.start, dir * len), end: addDays(p.end, dir * len) }; }
  const span = { mese: 1, trimestre: 3, semestre: 6, anno: 12 }[p.modo];
  return periodo(p.modo, addMonths(p.start, dir * span));
}
// il periodo "di prima" della stessa lunghezza, per i confronti
export const prima = p => sposta(p, -1);
export function etichetta(p) {
  const s = parse(p.start), e = parse(p.end);
  if (p.modo === 'mese') return cap(MESI[s.getMonth()]) + ' ' + s.getFullYear();
  if (p.modo === 'trimestre') return `${Math.floor(s.getMonth() / 3) + 1}° trimestre ${s.getFullYear()}`;
  if (p.modo === 'semestre') return `${s.getMonth() < 6 ? '1°' : '2°'} semestre ${s.getFullYear()}`;
  if (p.modo === 'anno') return 'Anno ' + s.getFullYear();
  const same = s.getFullYear() === e.getFullYear();
  return `${s.getDate()} ${MESI3[s.getMonth()]}${same ? '' : ' ' + s.getFullYear()} – ${e.getDate()} ${MESI3[e.getMonth()]} ${e.getFullYear()}`;
}
export function etichettaBreve(p) {
  const s = parse(p.start);
  if (p.modo === 'mese') return MESI[s.getMonth()];
  if (p.modo === 'anno') return String(s.getFullYear());
  return etichetta(p).replace(/ \d{4}$/, '');
}
const inP = (d, p) => d >= p.start && d <= p.end;

// ====================== conti ======================
export const contoById = (s, id) => s.conti.find(c => c.id === id);
export const principale = s => s.conti.find(c => c.principale) || s.conti[0];

// effetto di un movimento su un conto (+ entra, − esce)
export function effetto(m, contoId) {
  let v = 0;
  if (m.conto === contoId) v += (m.tipo === 'entrata' || m.tipo === 'rimborso') ? m.importo : -m.importo;
  if (m.tipo === 'trasferimento' && m.contoDest === contoId) v += m.importo;
  return v;
}
// saldo a fine giornata "d". saldoIniziale = saldo all'inizio di dataIniziale; funziona anche andando indietro nel tempo.
export function saldoAl(s, contoId, d = today()) {
  const c = contoById(s, contoId); if (!c) return 0;
  let v = c.saldoIniziale;
  for (const m of s.movimenti) {
    if (m.conto !== contoId && m.contoDest !== contoId) continue;
    if (m.data >= c.dataIniziale && m.data <= d) v += effetto(m, contoId);
    else if (m.data > d && m.data < c.dataIniziale) v -= effetto(m, contoId);
  }
  return round2(v);
}
export const saldi = (s, d = today()) => s.conti.map(c => ({ ...c, saldo: saldoAl(s, c.id, d) }));

// ====================== categorie ======================
export const catInfo = (s, nome) => s.categorie.find(c => c.nome === nome) || { nome: nome || 'Senza categoria', gruppo: 'desiderio', fissa: false };
export const ndOf = (s, m) => m.nd || catInfo(s, m.categoria).gruppo;
export const fissaOf = (s, m) => m.fissa ?? catInfo(s, m.categoria).fissa;
export function indovinaCategoria(s, descr) {
  const d = (descr || '').toLowerCase();
  const r = s.regole.find(([k]) => k && d.includes(k.toLowerCase()));
  return r ? r[1] : '';
}

// ====================== tasse ======================
export const regimeAl = (s, d) => [...s.impostazioni.regimi].filter(r => r.dal <= d).pop() || { tipo: 'nessuna', pct: 0 };
export const tassaPct = (s, d) => { const r = regimeAl(s, d); return r.tipo === 'nessuna' ? 0 : (+r.pct || 0) / 100; };
// stima "da manuale" per il forfettario: reddito = incasso × coefficiente; contributi sul reddito; imposta sul reddito meno contributi
export function stimaForfettario(r) {
  const c = (+r.coeff || 62) / 100, inps = (+r.contributi || 0) / 100, imp = (+r.imposta || 5) / 100;
  return c * (inps + imp * (1 - inps));
}
// tasse maturate (da accantonare) e già pagate fino al giorno d
export function tasseSituazione(s, d = today()) {
  let maturate = 0, pagate = 0;
  for (const m of s.movimenti) {
    if (m.data > d) continue;
    if (m.tipo === 'entrata' && m.lavoro) maturate += m.importo * tassaPct(s, m.data);
    if (m.tipo === 'spesa' && m.categoria === 'Tasse e contributi') pagate += m.importo;
  }
  const accantonato = s.conti.filter(c => c.tipo === 'tasse').reduce((a, c) => a + saldoAl(s, c.id, d), 0);
  const daPagare = Math.max(0, maturate - pagate);
  return { maturate: round2(maturate), pagate: round2(pagate), daPagare: round2(daPagare), accantonato: round2(accantonato), manca: round2(Math.max(0, daPagare - accantonato)) };
}

// ====================== statistiche di un periodo ======================
export function stats(s, p) {
  const r = { entLavoro: 0, entAltre: 0, tasse: 0, spese: 0, rimborsi: 0, fisse: 0, necessita: 0, desideri: 0, versatoRisparmi: 0, investito: 0, versatoTasse: 0, prelievi: 0,
    perCat: {}, n: 0, daControllare: 0 };
  const len = daysBetween(p.start, p.end) + 1, daily = new Array(len).fill(0);
  for (const m of s.movimenti) {
    if (!inP(m.data, p)) continue;
    r.n++; if (m.daControllare) r.daControllare++;
    if (m.tipo === 'entrata') {
      if (m.lavoro) { r.entLavoro += m.importo; r.tasse += m.importo * tassaPct(s, m.data); } else r.entAltre += m.importo;
    } else if (m.tipo === 'spesa' || m.tipo === 'rimborso') {
      const sg = m.tipo === 'spesa' ? 1 : -1, v = sg * m.importo;
      r.spese += v; if (sg < 0) r.rimborsi += m.importo;
      r.perCat[m.categoria || 'Senza categoria'] = (r.perCat[m.categoria || 'Senza categoria'] || 0) + v;
      if (fissaOf(s, m)) r.fisse += v; else if (ndOf(s, m) === 'necessita') r.necessita += v; else r.desideri += v;
      daily[daysBetween(p.start, m.data)] += v;
    } else if (m.tipo === 'trasferimento') {
      const from = contoById(s, m.conto), to = contoById(s, m.contoDest);
      if (to?.tipo === 'risparmio' && from?.tipo !== 'risparmio') r.versatoRisparmi += m.importo;
      if (from?.tipo === 'risparmio' && to?.tipo !== 'risparmio') r.versatoRisparmi -= m.importo;
      if (to?.tipo === 'investimento') r.investito += m.importo;
      if (from?.tipo === 'investimento') r.investito -= m.importo;
      if (to?.tipo === 'tasse') r.versatoTasse += m.importo;
      if (to?.tipo === 'contanti' && from?.tipo !== 'contanti') r.prelievi += m.importo;
    }
  }
  r.netto = r.entLavoro - r.tasse;
  r.disponibili = r.netto + r.entAltre;
  r.saldo = r.disponibili - r.spese;
  r.tassoRisparmio = r.disponibili > 0 ? r.saldo / r.disponibili : null;
  r.pesoFisse = r.disponibili > 0 ? r.fisse / r.disponibili : null;
  let acc = 0; r.cum = daily.map(v => (acc += v));
  r.daily = daily;
  r.cats = Object.entries(r.perCat).filter(([, v]) => Math.abs(v) > .004).sort((a, b) => b[1] - a[1]);
  r.giorni = len;
  for (const k of ['entLavoro', 'entAltre', 'tasse', 'spese', 'fisse', 'necessita', 'desideri', 'netto', 'disponibili', 'saldo', 'versatoRisparmi', 'investito']) r[k] = round2(r[k]);
  return r;
}

// statistiche mese per mese tra due date (per resoconti e grafici lunghi)
export function perMese(s, start, end) {
  const out = []; let m = monthStart(start);
  while (m <= end) { const p = { modo: 'mese', start: m, end: monthEnd(m) }; out.push({ mese: m, ...stats(s, p) }); m = addMonths(m, 1); }
  return out;
}

// ====================== impegni (rate, debiti, abbonamenti) ======================
// date di pagamento di un impegno tra from e to (incluse)
export function scadenze(imp, from, to) {
  if (!imp.inizio || imp.frequenza === 'nessuna' || !(+imp.importo > 0)) return [];
  const out = [], fine = imp.fine || '9999-12-31';
  // per rate e debiti: si smette quando il residuo arriva a zero
  let restanti = Infinity;
  if ((imp.tipo === 'rata' || imp.tipo === 'debito') && imp.residuo != null && imp.residuoAl) restanti = Math.ceil((+imp.residuo - 0.005) / +imp.importo);
  if (imp.frequenza === 'una') { if (imp.inizio >= from && imp.inizio <= to) out.push(imp.inizio); return out; }
  const step = imp.frequenza === 'annuale' ? 12 : 1;
  const g = +imp.giorno || parse(imp.inizio).getDate();
  let k = 0, dopo = 0;
  for (let i = 0; i < 600; i++) {
    const base = addMonths(monthStart(imp.inizio), i * step), last = parse(monthEnd(base)).getDate();
    const d = base.slice(0, 8) + String(Math.min(g, last)).padStart(2, '0');
    if (d < imp.inizio) continue;
    if (d > fine || d > to) break;
    if (imp.residuoAl && d > imp.residuoAl) { dopo++; if (dopo > restanti) break; }
    if (d >= from) out.push(d);
    k++;
  }
  return out;
}
// residuo di un debito/rata a una certa data (si assume che le rate vengano pagate)
export function residuoAl(imp, d = today()) {
  if (imp.residuo == null) return 0;
  const base = +imp.residuo, ref = imp.residuoAl || today(), q = +imp.importo || 0;
  if (!q) return base;
  if (d >= ref) return Math.max(0, round2(base - scadenze(imp, addDays(ref, 1), d).length * q));
  return round2(base + scadenze(imp, addDays(d, 1), ref).length * q);
}
export const isDebito = i => i.tipo === 'rata' || i.tipo === 'debito';
export const debitiTotali = (s, d = today()) => round2(s.impegni.filter(isDebito).reduce((a, i) => a + residuoAl(i, d), 0));

// tutti i pagamenti in un intervallo, ordinati
export function pagamenti(s, from, to) {
  const out = [];
  for (const i of s.impegni) for (const d of scadenze(i, from, to)) out.push({ data: d, imp: i, importo: +i.importo });
  return out.sort((a, b) => a.data.localeCompare(b.data));
}
// data in cui finisce di pagare un debito
export function fineDebito(imp) {
  if (!isDebito(imp) || !(+imp.importo > 0) || imp.frequenza === 'nessuna') return null;
  const all = scadenze(imp, addDays(imp.residuoAl || today(), 1), '2100-01-01');
  return all.length ? all[all.length - 1] : null;
}

// ====================== patrimonio ======================
// patrimonio netto = soldi su tutti i conti + beni − debiti − tasse ancora da pagare
export function patrimonio(s, d = today()) {
  const conti = saldi(s, d);
  const liquidi = conti.filter(c => c.tipo !== 'investimento').reduce((a, c) => a + c.saldo, 0);
  const investimenti = conti.filter(c => c.tipo === 'investimento').reduce((a, c) => a + c.saldo, 0);
  const beni = s.beni.reduce((a, b) => a + (+b.valore || 0), 0);
  const debiti = debitiTotali(s, d);
  const tasse = tasseSituazione(s, d).daPagare;
  return { liquidi: round2(liquidi), investimenti: round2(investimenti), beni: round2(beni), debiti, tasse, netto: round2(liquidi + investimenti + beni - debiti - tasse), conti };
}
export function primaData(s) {
  const ds = s.movimenti.map(m => m.data).concat(s.conti.map(c => c.dataIniziale)).sort();
  return ds[0] || today();
}
// valore a fine mese, dal primo mese con dati a oggi
export function seriePatrimonio(s, fino = today()) {
  const out = []; let m = monthStart(primaData(s));
  while (m <= fino) { const e = monthEnd(m) < fino ? monthEnd(m) : fino; out.push({ data: e, mese: m, ...patrimonio(s, e) }); m = addMonths(m, 1); }
  return out;
}

// ====================== pacing: dove arrivi a fine trimestre / semestre / anno ======================
export function pacing(s, ref = today()) {
  const serie = seriePatrimonio(s, ref), N = Math.max(1, +s.impostazioni.mesiPrevisione || 3);
  const ora = serie.length ? serie[serie.length - 1].netto : 0;
  // variazione media al mese sugli ultimi N mesi chiusi (più il mese in corso pesato per i giorni passati)
  const startIdx = Math.max(0, serie.length - 1 - N);
  const from = serie[startIdx], mesiFatti = Math.max(.5, daysBetween(from.data, ref) / 30.44);
  const media = serie.length > 1 ? (ora - from.netto) / mesiFatti : 0;
  const traguardi = ['trimestre', 'semestre', 'anno'].map(modo => {
    const p = periodo(modo, ref), mesi = Math.max(0, daysBetween(ref, p.end) / 30.44);
    return { modo, fine: p.end, etichetta: etichetta(p), stima: round2(ora + media * mesi), mesi };
  });
  const target = +s.impostazioni.obiettivoPatrimonio || 0;
  // a ottobre trimestre, semestre e anno finiscono tutti il 31/12: li mostro una volta sola
  const uniti = [];
  for (const t of traguardi) { const u = uniti.find(x => x.fine === t.fine); if (u) { u.modi.push(t.modo); u.etichetta += ' · ' + t.etichetta; } else uniti.push({ ...t, modi: [t.modo] }); }
  return { serie, ora, media: round2(media), traguardi, uniti, target, N };
}

// proiezione di una cifra del periodo in corso a fine periodo (es. spese)
export function proiezione(valore, p, ref = today()) {
  if (ref < p.start) return valore;
  if (ref >= p.end) return valore;
  const fatti = daysBetween(p.start, ref) + 1, tot = daysBetween(p.start, p.end) + 1;
  return round2(valore / fatti * tot);
}

// ====================== obiettivi ======================
export function obiettivo(s, o, ref = today()) {
  const messo = o.conto ? saldoAl(s, o.conto, ref) : (+o.messo || 0);
  const target = +o.target || 0, mancano = Math.max(0, round2(target - messo));
  const mesiRim = o.scadenza ? Math.max(1, Math.ceil(daysBetween(ref, o.scadenza) / 30.44)) : null;
  const quota = mesiRim ? round2(mancano / mesiRim) : 0;
  let atteso = null, stato = 'neu';
  if (o.scadenza && o.creato && o.scadenza > o.creato) {
    const tot = daysBetween(o.creato, o.scadenza), fatti = Math.min(tot, Math.max(0, daysBetween(o.creato, ref)));
    atteso = target * fatti / tot;
    stato = messo >= target ? 'ok' : messo >= atteso * .95 ? 'ok' : messo >= atteso * .7 ? 'warn' : 'bad';
  }
  if (messo >= target && target > 0) stato = 'ok';
  const scaduto = o.scadenza && ref > o.scadenza && messo < target;
  // versato questo mese verso il salvadanaio collegato
  let versatoMese = 0;
  if (o.conto) { const ms = monthStart(ref); for (const m of s.movimenti) if (m.data >= ms && m.data <= ref) versatoMese += effetto(m, o.conto); }
  return { ...o, messo: round2(messo), mancano, mesiRim, quota, atteso, stato: scaduto ? 'bad' : stato, prog: target ? Math.min(1, Math.max(0, messo / target)) : 0, versatoMese: round2(versatoMese), fatto: messo >= target && target > 0 };
}

// ====================== indicatori "da commercialista" ======================
export function indicatori(s, ref = today()) {
  const imp = s.impostazioni, pr = principale(s);
  // media degli ultimi 3 mesi chiusi (se non ci sono, il mese in corso)
  const ultimi = [];
  for (let i = 1; i <= 3; i++) { const ms = addMonths(monthStart(ref), -i); if (ms >= monthStart(primaData(s))) ultimi.push(stats(s, { modo: 'mese', start: ms, end: monthEnd(ms) })); }
  const base = ultimi.length ? ultimi : [stats(s, periodo('mese', ref))];
  const avg = k => base.reduce((a, x) => a + (x[k] || 0), 0) / base.length;
  const disponibili = avg('disponibili'), fisse = avg('fisse'), necessita = avg('necessita'), spese = avg('spese');
  // rate dei debiti al mese (dal piano impegni)
  const rate = s.impegni.filter(isDebito).reduce((a, i) => a + (i.frequenza === 'mensile' && residuoAl(i, ref) > 0 ? +i.importo : 0), 0);
  const tx = tasseSituazione(s, ref);
  const sal = saldi(s, ref);
  const liquidi = sal.filter(c => ['banca', 'contanti', 'risparmio'].includes(c.tipo)).reduce((a, c) => a + c.saldo, 0);
  const liberi = round2(liquidi - tx.manca);
  const essenziali = round2(fisse + necessita);
  const mesiAutonomia = essenziali > 0 ? liberi / essenziali : null;

  // ----- oggi: quanto puoi spendere -----
  const fineMese = monthEnd(ref), giorniRim = daysBetween(ref, fineMese) + 1;
  const saldoPr = saldoAl(s, pr.id, ref);
  const daPagare = pagamenti(s, addDays(ref, 1), fineMese).filter(x => !x.imp.conto || x.imp.conto === pr.id).reduce((a, x) => a + x.importo, 0);
  const obs = s.obiettivi.map(o => obiettivo(s, o, ref)).filter(o => !o.fatto);
  const quoteMancanti = obs.reduce((a, o) => a + (o.conto ? Math.max(0, o.quota - Math.max(0, o.versatoMese)) : 0), 0);
  const mese = stats(s, periodo('mese', ref));
  const tasseMese = Math.max(0, mese.tasse - mese.versatoTasse);
  const spendibile = round2(saldoPr - imp.cuscinetto - daPagare - quoteMancanti - tasseMese);
  const perGiorno = round2(Math.max(0, spendibile) / giorniRim);

  return {
    mesiBase: base.length, disponibili: round2(disponibili), spese: round2(spese), essenziali,
    tassoRisparmio: disponibili > 0 ? (disponibili - spese) / disponibili : null,
    pesoFisse: disponibili > 0 ? fisse / disponibili : null,
    pesoDebiti: disponibili > 0 ? rate / disponibili : null, rate: round2(rate),
    liquidi: round2(liquidi), liberi, mesiAutonomia,
    oggi: { saldoPr, cuscinetto: +imp.cuscinetto, daPagare: round2(daPagare), quoteMancanti: round2(quoteMancanti), tasseMese: round2(tasseMese), spendibile, perGiorno, giorniRim },
    desideri: { speso: mese.desideri, budget: +imp.budgetDesideri },
    tasse: tx,
  };
}

// voti semplici per i KPI
export const voto = {
  risparmio: v => v == null ? 'neu' : v >= .2 ? 'ok' : v >= .1 ? 'warn' : 'bad',
  fisse: v => v == null ? 'neu' : v <= .5 ? 'ok' : v <= .6 ? 'warn' : 'bad',
  debiti: v => v == null ? 'neu' : v < .3 ? 'ok' : v <= .35 ? 'warn' : 'bad',
  autonomia: (v, t) => v == null ? 'neu' : v >= t ? 'ok' : v >= t / 2 ? 'warn' : 'bad',
};
// tasso di risparmio: se hai speso più di quanto entrato non ha senso una %, scrivo "in rosso"
export const fmtRisp = v => v == null ? '—' : v < 0 ? 'in rosso' : Math.round(v * 100) + '%';
export const VOTO_TXT = { ok: 'Bene', warn: 'Attenzione', bad: 'Da sistemare', neu: 'Pochi dati' };
