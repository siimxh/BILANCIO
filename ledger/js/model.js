// Forma dei dati di un utente. Tutto sta in un unico documento JSON (uno per utente su Supabase).
import { uid, today, round2 } from './util.js';

export const TIPI_CONTO = {
  banca: 'Conto in banca',
  contanti: 'Contanti (portafoglio)',
  risparmio: 'Salvadanaio / risparmi',
  tasse: 'Salvadanaio tasse',
  investimento: 'Investimenti',
};

export const TIPI_MOV = {
  spesa: 'Spesa',
  entrata: 'Entrata',
  trasferimento: 'Spostamento tra conti',
  rimborso: 'Rimborso',
};

export const TIPI_IMPEGNO = {
  rata: 'Rata / finanziamento',
  debito: 'Debito con una persona',
  abbonamento: 'Abbonamento',
  annuale: 'Spesa annuale',
  tasse: 'Tasse / contributi',
};

export const FREQ = { mensile: 'Ogni mese', annuale: 'Ogni anno', una: 'Una volta', nessuna: 'Senza scadenza fissa' };

export const CATEGORIE_BASE = [
  { nome: 'Casa e bollette', gruppo: 'necessita', fissa: true },
  { nome: 'Spesa alimentare', gruppo: 'necessita', fissa: false },
  { nome: 'Trasporti', gruppo: 'necessita', fissa: false },
  { nome: 'Salute e sport', gruppo: 'necessita', fissa: false },
  { nome: 'Abbonamenti', gruppo: 'desiderio', fissa: true },
  { nome: 'Rate e debiti', gruppo: 'necessita', fissa: true },
  { nome: 'Uscite e bar', gruppo: 'desiderio', fissa: false },
  { nome: 'Fumo', gruppo: 'desiderio', fissa: false },
  { nome: 'Shopping', gruppo: 'desiderio', fissa: false },
  { nome: 'Lavoro', gruppo: 'necessita', fissa: false },
  { nome: 'Tasse e contributi', gruppo: 'necessita', fissa: false },
  { nome: 'Regali e altro', gruppo: 'desiderio', fissa: false },
  { nome: 'Contanti non segnati', gruppo: 'desiderio', fissa: false },
];

export const IMPOSTAZIONI_BASE = {
  cuscinetto: 100,          // € da lasciare sempre sul conto principale
  risparmioPct: 20,         // % di ogni entrata da mettere da parte
  budgetDesideri: 150,      // € al mese per gli sfizi
  mesiAutonomiaTarget: 3,   // quanti mesi senza entrate vuoi poter reggere
  mesiPrevisione: 3,        // su quanti mesi passati si basano le previsioni
  obiettivoPatrimonio: 0,   // dove vuoi arrivare a fine anno (0 = nessuno)
  // regime fiscale con data di inizio. Fino al 2027 niente P.IVA: incassi già netti.
  regimi: [
    { id: 'r0', dal: '2000-01-01', tipo: 'nessuna', pct: 0 },
    { id: 'r1', dal: '2027-01-01', tipo: 'forfettario', pct: 25, coeff: 62, imposta: 5, contributi: 26 },
  ],
};

export function vuoto(nome = '') {
  const t = today();
  return normalize({
    versione: 1,
    profilo: { nome },
    conti: [
      { id: 'principale', nome: 'Revolut', tipo: 'banca', saldoIniziale: 0, dataIniziale: t, principale: true },
      { id: 'contanti', nome: 'Contanti', tipo: 'contanti', saldoIniziale: 0, dataIniziale: t },
    ],
    categorie: CATEGORIE_BASE.map(c => ({ ...c })),
    regole: [],
    movimenti: [], impegni: [], obiettivi: [], beni: [],
    impostazioni: structuredClone(IMPOSTAZIONI_BASE),
  });
}

// completa i campi mancanti, così i dati vecchi non rompono niente
export function normalize(s) {
  s = s || {};
  s.versione = 1;
  s.profilo = { nome: '', ...(s.profilo || {}) };
  s.conti = (s.conti || []).map(c => ({ saldoIniziale: 0, dataIniziale: today(), ...c, saldoIniziale: +c.saldoIniziale || 0 }));
  if (!s.conti.some(c => c.principale) && s.conti[0]) s.conti[0].principale = true;
  s.categorie = s.categorie?.length ? s.categorie : CATEGORIE_BASE.map(c => ({ ...c }));
  s.regole = s.regole || [];
  s.movimenti = (s.movimenti || []).map(m => ({ id: m.id || uid(), ...m, importo: round2(Math.abs(+m.importo || 0)) }));
  s.impegni = (s.impegni || []).map(i => ({ id: i.id || uid(), ...i }));
  s.obiettivi = (s.obiettivi || []).map(o => ({ id: o.id || uid(), creato: today(), messo: 0, ...o }));
  s.beni = s.beni || [];
  s.impostazioni = { ...structuredClone(IMPOSTAZIONI_BASE), ...(s.impostazioni || {}) };
  s.impostazioni.regimi = [...s.impostazioni.regimi].sort((a, b) => a.dal.localeCompare(b.dal));
  return s;
}

// --------- conversione dal vecchio bilancio (bilancio-vecchio-import.json) ---------
const MAP_CAT = {
  'Casa & Utenze': 'Casa e bollette', 'Alimentazione': 'Spesa alimentare', 'Trasporti': 'Trasporti',
  'Salute & Sport': 'Salute e sport', 'Abbonamenti': 'Abbonamenti', 'Divertimento & Uscite': 'Uscite e bar',
  'Shopping & Extra': 'Shopping', 'Debiti & Rate': 'Rate e debiti', 'Spese lavorative': 'Lavoro', 'Da categorizzare': 'Regali e altro',
};
export function daVecchio(old, nome = '') {
  const s = vuoto(nome);
  const inv = { id: 'investimenti', nome: 'Investimenti', tipo: 'investimento', saldoIniziale: 0, dataIniziale: '2026-01-01' };
  s.conti[0].dataIniziale = '2026-01-01'; s.conti[0].saldoIniziale = +(old.saldo_inizio?.['2026-01-01'] || 0);
  s.conti[1].dataIniziale = '2026-01-01';
  s.conti.push(inv);
  for (const m of old.movimenti || []) {
    const imp = Math.abs(+m.importo || 0); if (!imp) continue;
    const base = { id: uid(), data: m.data, importo: imp, conto: 'principale', descr: m.descrizione || '', note: m.note || '' };
    if (m.tipo === 'Entrata') {
      // le "ricariche" e i regali NON sono lavoro finché non lo dice lui (vedi domande al deploy)
      const lavoro = m.categoria === 'Entrate Extra' && !/regalo|pasqua|ricarica/i.test(m.descrizione || '');
      s.movimenti.push({ ...base, tipo: 'entrata', lavoro, daControllare: true });
    } else if (m.categoria === 'Investimenti/Trading' || /^Investimento/.test(m.tipo)) {
      s.movimenti.push({ ...base, tipo: 'trasferimento', contoDest: 'investimenti' });
    } else {
      const cat = MAP_CAT[m.categoria] || 'Regali e altro';
      const mov = { ...base, tipo: 'spesa', categoria: cat };
      if (m.necessita_desiderio === 'N') mov.nd = 'necessita'; else if (m.necessita_desiderio === 'D') mov.nd = 'desiderio';
      if (m.ricorrente === 'Sì') mov.fissa = true;
      if (!m.descrizione) mov.daControllare = true;
      s.movimenti.push(mov);
    }
  }
  s.regole = (old.regole || []).map(([k, c]) => [k, MAP_CAT[c] || c]).filter(([, c]) => s.categorie.some(x => x.nome === c));
  for (const d of old.debiti || []) {
    s.impegni.push({ id: uid(), nome: d.descrizione, tipo: /personale/i.test(d.categoria) ? 'debito' : 'rata', importo: 0, frequenza: 'nessuna', inizio: today(), residuo: +d.mancante || 0, residuoAl: today(), note: d.nota || '' });
  }
  return normalize(s);
}
