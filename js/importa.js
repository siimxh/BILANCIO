// Lettura degli estratti conto: CSV di Revolut (inglese o italiano) o CSV semplice (data;descrizione;importo;categoria).
import { uid, round2 } from './util.js';
import { riconosci, principale } from './engine.js';

function splitCSV(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
const num = v => { v = String(v ?? '').trim().replace(/\s|€/g, ''); if (/,\d{1,2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.'); return parseFloat(v); };
const toIso = v => { v = String(v || '').trim(); let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return ''; };
// stesso giorno, stesso importo, stesso nome della banca = doppione (anche se poi l'hai rinominato)
export const chiave = m => `${m.data}|${(+m.importo).toFixed(2)}|${(m.descrBanca || m.descr || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;

export function leggi(text, s, contoId) {
  const rows = splitCSV(text.replace(/^﻿/, ''));
  if (rows.length < 2) return { movimenti: [], formato: 'vuoto' };
  const h = rows[0].map(x => x.trim().toLowerCase());
  const col = (...names) => h.findIndex(x => names.includes(x));
  const conto = contoId || principale(s).id;
  const contanti = s.conti.find(c => c.tipo === 'contanti')?.id;
  const salvadanaio = s.conti.find(c => c.tipo === 'risparmio')?.id;
  const out = [];
  const iType = col('type', 'tipo'), iDate = col('completed date', 'data di completamento', 'started date', 'data di inizio'), iDesc = col('description', 'descrizione'),
    iAmt = col('amount', 'importo'), iFee = col('fee', 'costo', 'commissione'), iState = col('state', 'stato'), iCur = col('currency', 'valuta');
  const revolut = iType >= 0 && iAmt >= 0 && iDate >= 0 && iDesc >= 0;
  if (revolut) {
    for (const r of rows.slice(1)) {
      const stato = (r[iState] || '').toUpperCase();
      if (stato && !/COMPLET/.test(stato)) continue;
      if (iCur >= 0 && r[iCur] && r[iCur].trim().toUpperCase() !== 'EUR') continue;
      const a = num(r[iAmt]), fee = iFee >= 0 ? Math.abs(num(r[iFee]) || 0) : 0, data = toIso(r[iDate]) || toIso(r[col('started date', 'data di inizio')]);
      if (!data || isNaN(a) || (!a && !fee)) continue;
      const type = (r[iType] || '').toUpperCase(), descr = (r[iDesc] || '').trim();
      const base = { id: uid(), data, descr, descrBanca: descr, conto, fonte: 'Revolut CSV' };
      const ric = riconosci(s, descr);
      if (ric?.nome) base.descr = ric.nome;
      if (/ATM|PRELIEVO/.test(type) && a < 0) { out.push({ ...base, tipo: 'trasferimento', importo: round2(-a), contoDest: contanti || conto }); }
      else if (/EXCHANGE|CAMBIO/.test(type)) continue;
      else if (/pocket|salvadanaio|savings|risparmi/i.test(descr) && salvadanaio) out.push({ ...base, tipo: 'trasferimento', importo: round2(Math.abs(a)), conto: a < 0 ? conto : salvadanaio, contoDest: a < 0 ? salvadanaio : conto });
      else if (/REFUND|RIMBORSO/.test(type) && a > 0) out.push({ ...base, tipo: 'rimborso', importo: round2(a), categoria: ric?.categoria || 'Shopping', daControllare: !ric });
      else if (a > 0) out.push({ ...base, tipo: 'entrata', importo: round2(a), lavoro: ric?.categoria !== 'Entrata non da lavoro', daControllare: !ric });
      else if (a < 0) out.push({ ...base, tipo: 'spesa', importo: round2(-a), categoria: ric?.categoria || '', daControllare: !ric });
      if (fee > 0) out.push({ id: uid(), data, descr: 'Commissione ' + descr, descrBanca: descr, conto, tipo: 'spesa', importo: round2(fee), categoria: 'Casa e bollette', fonte: 'Revolut CSV' });
    }
    return { movimenti: out, formato: 'Revolut' };
  }
  // CSV semplice
  const jD = col('data', 'date'), jS = col('descrizione', 'description', 'descr'), jI = col('importo', 'amount'), jC = col('categoria', 'category');
  if (jD < 0 || jI < 0) return { movimenti: [], formato: 'sconosciuto', colonne: h };
  for (const r of rows.slice(1)) {
    const data = toIso(r[jD]), a = num(r[jI]), descr = jS >= 0 ? (r[jS] || '').trim() : '';
    if (!data || !a || isNaN(a)) continue;
    const catFile = jC >= 0 ? (r[jC] || '').trim() : '';
    const ric = riconosci(s, descr);
    const cat = s.categorie.some(c => c.nome === catFile) ? catFile : ric?.categoria;
    const nome = ric?.nome || descr;
    out.push(a > 0 ? { id: uid(), data, descr: nome, descrBanca: descr, conto, tipo: 'entrata', importo: round2(a), lavoro: ric?.categoria !== 'Entrata non da lavoro', daControllare: !ric, fonte: 'CSV' }
      : { id: uid(), data, descr: nome, descrBanca: descr, conto, tipo: 'spesa', importo: round2(-a), categoria: cat || '', daControllare: !cat, fonte: 'CSV' });
  }
  return { movimenti: out, formato: 'CSV semplice' };
}
