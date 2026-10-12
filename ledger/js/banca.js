// Movimenti che arrivano da soli da Revolut (Enable Banking).
// Il server li scarica nella tabella banca_movimenti; qui li trasformo in movimenti di Ledger
// con le stesse regole dell'import CSV: riconosciuti dalle tue regole o dal dizionario,
// gli altri finiscono in "Da sistemare" con il pallino rosso.
import { online, client } from '../../shared/supa.js';
import { uid, round2 } from './util.js';
import { riconosci, principale } from './engine.js';
import { chiave } from './importa.js';

const MAX_IDS = 3000;

// una riga della banca → movimento di Ledger (o null se va ignorata)
export function daBanca(s, r) {
  if (r.valuta && r.valuta.toUpperCase() !== 'EUR') return null;
  const a = +r.importo;
  if (!a || isNaN(a)) return null;
  const descr = (r.controparte || r.descrizione || '').trim();
  const testo = `${r.controparte || ''} ${r.descrizione || ''}`;
  if (/exchanged to|cambiat[oi] in|exchange/i.test(testo)) return null;
  const conto = s.conti.find(c => c.bancaUid && c.bancaUid === r.conto)?.id || principale(s).id;
  const contanti = s.conti.find(c => c.tipo === 'contanti')?.id;
  const salvadanaio = s.conti.find(c => c.tipo === 'risparmio')?.id;
  const base = { id: uid(), data: r.data, descr: descr || 'Movimento Revolut', descrBanca: descr, conto, fonte: 'Revolut automatico', idBanca: r.id_banca };
  const ric = riconosci(s, testo);
  if (ric?.nome) base.descr = ric.nome;
  if (/\batm\b|prelievo|cash withdrawal/i.test(testo) && a < 0) return { ...base, tipo: 'trasferimento', importo: round2(-a), contoDest: contanti || conto };
  if (/pocket|salvadanaio|savings|risparmi/i.test(testo) && salvadanaio) return { ...base, tipo: 'trasferimento', importo: round2(Math.abs(a)), conto: a < 0 ? conto : salvadanaio, contoDest: a < 0 ? salvadanaio : conto };
  if (/refund|rimborso/i.test(testo) && a > 0) return { ...base, tipo: 'rimborso', importo: round2(a), categoria: ric?.categoria || 'Shopping', daControllare: !ric };
  if (a > 0) return { ...base, tipo: 'entrata', importo: round2(a), lavoro: ric?.categoria !== 'Entrata non da lavoro', daControllare: !ric };
  return { ...base, tipo: 'spesa', importo: round2(-a), categoria: ric?.categoria || '', daControllare: !ric };
}

// prende dal server le righe nuove e le aggiunge (senza doppioni) con modifica()
export async function importaBanca(state, modifica) {
  if (!online) return null;
  const c = await client();
  const visto = state.banca?.ultimo || null;
  let q = c.from('banca_movimenti').select('id_banca,conto,data,importo,valuta,descrizione,controparte,importato_il').order('importato_il', { ascending: true }).limit(1000);
  if (visto) q = q.gt('importato_il', visto);
  const { data, error } = await q;
  if (error || !data?.length) return error ? null : { nuovi: 0, daSistemare: 0 };

  const ids = new Set([...(state.banca?.ids || []), ...state.movimenti.map(m => m.idBanca).filter(Boolean)]);
  const chiavi = new Set(state.movimenti.map(chiave));
  const nuovi = [];
  for (const r of data) {
    if (ids.has(r.id_banca)) continue;
    ids.add(r.id_banca);
    const m = daBanca(state, r);
    if (!m) continue;
    const k = chiave(m);
    if (chiavi.has(k)) continue; // già caricato a mano col CSV
    chiavi.add(k);
    nuovi.push(m);
  }
  const ultimo = data[data.length - 1].importato_il;
  modifica(s => {
    s.movimenti.push(...nuovi);
    s.banca = { ...(s.banca || {}), ultimo, ids: [...ids].slice(-MAX_IDS) };
  });
  return { nuovi: nuovi.length, daSistemare: nuovi.filter(m => m.daControllare).length };
}
