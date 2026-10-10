// Dati di esempio INVENTATI per la modalità demo. Nessun dato reale qui dentro.
import { normalize, CATEGORIE_BASE, IMPOSTAZIONI_BASE } from './model.js';
import { iso, parse, today, addMonths, monthStart, round2 } from './util.js';

export function demo() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const between = (a, b) => round2(a + rnd() * (b - a));
  const oggi = today(), inizio = '2026-01-01';
  const mov = []; let n = 0;
  const add = (data, o) => { if (data <= oggi) mov.push({ id: 'd' + (n++), data, ...o }); };
  const day = (ms, d) => { const x = parse(ms); x.setDate(Math.min(d, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return iso(x); };

  for (let ms = inizio; ms <= oggi; ms = addMonths(ms, 1)) {
    const k = parse(ms).getMonth();
    // entrate da lavoro (provvigioni) + qualche incasso in contanti
    add(day(ms, 5), { tipo: 'entrata', lavoro: true, importo: between(900, 1350), conto: 'principale', descr: 'Provvigioni mese precedente' });
    if (k % 2 === 1) add(day(ms, 20), { tipo: 'entrata', lavoro: true, importo: between(150, 400), conto: 'principale', descr: 'Bonus chiusure' });
    if (k % 3 === 0) add(day(ms, 12), { tipo: 'entrata', lavoro: true, importo: 100, conto: 'contanti', descr: 'Lavoretto pagato in contanti' });
    if (k % 2 === 0) add(day(ms, 1), { tipo: 'entrata', lavoro: false, importo: 50, conto: 'contanti', descr: 'Soldi dalla famiglia' });
    // fisse
    add(day(ms, 1), { tipo: 'spesa', categoria: 'Salute e sport', fissa: true, importo: 45, conto: 'principale', descr: 'Abbonamento palestra' });
    add(day(ms, 3), { tipo: 'spesa', categoria: 'Rate e debiti', importo: 120, conto: 'principale', descr: 'Rata finanziamento corso' });
    add(day(ms, 10), { tipo: 'spesa', categoria: 'Abbonamenti', importo: 10.99, conto: 'principale', descr: 'Spotify' });
    add(day(ms, 15), { tipo: 'spesa', categoria: 'Rate e debiti', importo: 51.25, conto: 'principale', descr: 'Rata telefono' });
    add(day(ms, 18), { tipo: 'spesa', categoria: 'Casa e bollette', importo: 9.99, conto: 'principale', descr: 'Ricarica telefono' });
    // salvadanai e investimenti (prima paghi te stesso)
    add(day(ms, 6), { tipo: 'trasferimento', importo: k < 5 ? 60 : 100, conto: 'principale', contoDest: 'emergenze', descr: 'Al salvadanaio emergenze' });
    add(day(ms, 6), { tipo: 'trasferimento', importo: 50, conto: 'principale', contoDest: 'auto', descr: 'Al salvadanaio auto' });
    if (k % 2 === 0) add(day(ms, 7), { tipo: 'trasferimento', importo: 50, conto: 'principale', contoDest: 'investimenti', descr: 'ETF mensile' });
    // prelievi
    add(day(ms, 4), { tipo: 'trasferimento', importo: 50, conto: 'principale', contoDest: 'contanti', descr: 'Prelievo bancomat' });
    // variabili
    for (let i = 0; i < 42; i++) {
      const d = day(ms, 1 + Math.floor(rnd() * 28)), r = rnd();
      if (r < .22) add(d, { tipo: 'spesa', categoria: 'Spesa alimentare', importo: between(6, 38), conto: 'principale', descr: pick(['Conad', 'Lidl', 'MD', 'Carrefour']) });
      else if (r < .42) add(d, { tipo: 'spesa', categoria: 'Uscite e bar', importo: between(4, 32), conto: rnd() < .3 ? 'contanti' : 'principale', descr: pick(['Bar', 'Pizzeria', 'McDonald\'s', 'Birreria', 'Sushi']) });
      else if (r < .58) add(d, { tipo: 'spesa', categoria: 'Fumo', importo: between(5, 6.5), conto: rnd() < .5 ? 'contanti' : 'principale', descr: 'Tabacchi' });
      else if (r < .7) add(d, { tipo: 'spesa', categoria: 'Trasporti', importo: between(15, 40), conto: 'principale', descr: pick(['Benzina', 'Autostrade', 'Parcheggio']) });
      else if (r < .76) add(d, { tipo: 'spesa', categoria: 'Shopping', importo: between(12, 70), conto: 'principale', descr: pick(['Vinted', 'Zalando', 'Amazon']) });
      else if (r < .8) add(d, { tipo: 'spesa', categoria: 'Salute e sport', importo: between(8, 30), conto: 'principale', descr: pick(['Farmacia', 'Integratori']) });
    }
    if (k === 3) { add(day(ms, 22), { tipo: 'spesa', categoria: 'Shopping', importo: 129, conto: 'principale', descr: 'Scarpe' }); add(day(ms, 25), { tipo: 'rimborso', categoria: 'Shopping', importo: 129, conto: 'principale', descr: 'Reso scarpe' }); }
    if (k === 6) add(day(ms, 14), { tipo: 'spesa', categoria: 'Uscite e bar', importo: 180, conto: 'principale', descr: 'Weekend al mare' });
  }

  // movimenti arrivati dalla banca che il tool non sa riconoscere: finiscono in "Da sistemare"
  const strani = [['SUMUP *STADIO ADRIATICO 4471', 12, 1], ['SQ *CHIOSCO LUNGOMARE', 8.5, 2], ['PAYPAL *GIGSTICKET 2291', 25, 3], ['POS 88123 ARCI CIRCOLO', 6, 5], ['SATISPAY*RISTORO PIAZZA', 14.2, 6], ['BONIFICO DA M. ROSSI', 40, 4]];
  const oggiD = parse(oggi);
  for (const [nome, imp, g] of strani) {
    const d = new Date(oggiD); d.setDate(d.getDate() - g);
    const entrata = nome.startsWith('BONIFICO');
    add(iso(d), entrata ? { tipo: 'entrata', lavoro: true, importo: imp, conto: 'principale', descr: nome, descrBanca: nome, daControllare: true, fonte: 'Revolut' }
      : { tipo: 'spesa', categoria: '', importo: imp, conto: 'principale', descr: nome, descrBanca: nome, daControllare: true, fonte: 'Revolut' });
  }

  return normalize({
    profilo: { nome: 'Demo' },
    conti: [
      { id: 'principale', nome: 'Revolut', tipo: 'banca', saldoIniziale: 240, dataIniziale: inizio, principale: true },
      { id: 'contanti', nome: 'Contanti', tipo: 'contanti', saldoIniziale: 30, dataIniziale: inizio },
      { id: 'emergenze', nome: 'Salvadanaio emergenze', tipo: 'risparmio', saldoIniziale: 0, dataIniziale: inizio },
      { id: 'auto', nome: 'Salvadanaio auto', tipo: 'risparmio', saldoIniziale: 0, dataIniziale: inizio },
      { id: 'fondotasse', nome: 'Fondo tasse', tipo: 'tasse', saldoIniziale: 0, dataIniziale: inizio },
      { id: 'investimenti', nome: 'Investimenti', tipo: 'investimento', saldoIniziale: 0, dataIniziale: inizio },
    ],
    categorie: CATEGORIE_BASE.map(c => ({ ...c })),
    regole: [['conad', 'Spesa alimentare'], ['lidl', 'Spesa alimentare'], ['tabacchi', 'Fumo'], ['benzina', 'Trasporti'], ['spotify', 'Abbonamenti'], ['vinted', 'Shopping']],
    movimenti: mov,
    impegni: [
      { id: 'i1', nome: 'Finanziamento corso', tipo: 'rata', importo: 120, frequenza: 'mensile', giorno: 3, inizio: '2025-10-03', residuo: 960, residuoAl: '2026-10-01', conto: 'principale' },
      { id: 'i2', nome: 'Rata telefono', tipo: 'rata', importo: 51.25, frequenza: 'mensile', giorno: 15, inizio: '2026-01-15', residuo: 1230, residuoAl: '2026-10-01', conto: 'principale' },
      { id: 'i3', nome: 'Prestito da un amico', tipo: 'debito', importo: 0, frequenza: 'nessuna', inizio: '2026-05-01', residuo: 600, residuoAl: '2026-10-01' },
      { id: 'i4', nome: 'Palestra', tipo: 'abbonamento', importo: 45, frequenza: 'mensile', giorno: 1, inizio: '2026-01-01', conto: 'principale' },
      { id: 'i5', nome: 'Spotify', tipo: 'abbonamento', importo: 10.99, frequenza: 'mensile', giorno: 10, inizio: '2026-01-10', conto: 'principale' },
      { id: 'i6', nome: 'Assicurazione scooter', tipo: 'annuale', importo: 380, frequenza: 'annuale', inizio: '2027-03-20', conto: 'principale' },
    ],
    obiettivi: [
      { id: 'o1', nome: 'Cuscinetto di emergenza', target: 1500, scadenza: '2027-03-31', conto: 'emergenze', creato: '2026-01-01' },
      { id: 'o2', nome: 'Restituire il prestito', target: 600, scadenza: '2027-02-28', messo: 150, creato: '2026-06-01' },
      { id: 'o3', nome: 'Patente A2', target: 400, scadenza: '2026-12-15', messo: 120, creato: '2026-09-01' },
      { id: 'o4', nome: 'Acconto auto', target: 6000, scadenza: '2028-06-30', conto: 'auto', creato: '2026-01-01' },
    ],
    beni: [],
    impostazioni: { ...structuredClone(IMPOSTAZIONI_BASE), obiettivoPatrimonio: 2500 },
  });
}
