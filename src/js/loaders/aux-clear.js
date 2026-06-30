// loaders/aux-clear.js — limpa fontes auxiliares ao substituir histórico

import { state } from '../state.js';
import { VidaDB } from '../storage/vidadb.js';

/** Remove CID, procedimentos e exames da memória e do IndexedDB. */
export async function clearAuxiliaryData() {
  state.cidRaw = [];
  state.procRaw = [];
  state.examesRaw = [];
  state.files.cid = '';
  state.files.proc = '';
  try {
    await Promise.all([
      VidaDB.clear('cid').catch(() => {}),
      VidaDB.clear('triagem').catch(() => {}),
    ]);
  } catch (e) { /* opcional */ }
}
