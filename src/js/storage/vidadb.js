// storage/vidadb.js — IndexedDB wrapper (browser-only, not testable in Node/jsdom)

import { TTL_KEY } from '../state.js';

const DB_NAME = 'vida_db';
const DB_VERSION = 1;
const STORES = {
  atendimentos: { keyPath: 'id', autoIncrement: true,
    indexes: ['dateKey','prof','cor','anoMes','pront','dh'] },
  cid:          { keyPath: 'id', autoIncrement: true,
    indexes: ['dateKey','cid','anoMes','idAtend'] },
  triagem:      { keyPath: 'id', autoIncrement: true,
    indexes: ['dateKey','cor','anoMes','triador'] },
};

let _db = null;
let _idbChain = Promise.resolve();

function _enqueueIdb(fn) {
  const run = _idbChain.then(() => fn()).catch(err => {
    console.warn('VidaDB queue:', err);
    throw err;
  });
  _idbChain = run.then(() => {}, () => {});
  return run;
}

async function open(){
  if(_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      for(const [name, cfg] of Object.entries(STORES)){
        if(!db.objectStoreNames.contains(name)){
          const store = db.createObjectStore(name, {
            keyPath: cfg.keyPath,
            autoIncrement: cfg.autoIncrement
          });
          cfg.indexes.forEach(idx => {
            store.createIndex(idx, idx, { unique: false });
          });
        }
      }
    };
  });
}

// Bulk insert — usa uma única transação para milhares de registros
async function bulkPut(storeName, rows){
  if(!rows || !rows.length) return 0;
  return _enqueueIdb(async () => {
    await open();
    const CHUNK = 1000;
    let totalInserted = 0;
    let failed = 0;
    for(let i=0; i<rows.length; i+=CHUNK){
      const chunk = rows.slice(i, i+CHUNK);
      const inserted = await new Promise((resolve) => {
        try {
          const db = _db;
          if(!db){ resolve(0); return; }
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          let count = 0;
          for(const r of chunk){
            const clean = { ...r };
            if(clean.dh instanceof Date) clean._dhTs = clean.dh.getTime();
            if(clean.dhAcol instanceof Date) clean._dhAcolTs = clean.dhAcol.getTime();
            if(clean.dhAtend instanceof Date) clean._dhAtendTs = clean.dhAtend.getTime();
            if(clean._dhTs != null) clean.dh = clean._dhTs;
            else if(clean.dh instanceof Date) clean.dh = clean.dh.getTime();
            delete clean.dhAcol; delete clean.dhAtend;
            try { store.put(clean); count++; } catch(e){ failed++; }
          }
          tx.oncomplete = () => resolve(count);
          tx.onerror = () => { console.warn('VidaDB tx error:', tx.error); resolve(count); };
          tx.onabort = () => { console.warn('VidaDB tx abort'); resolve(count); };
        } catch(err){
          console.warn('VidaDB chunk error:', err);
          resolve(0);
        }
      });
      totalInserted += inserted;
      await new Promise(r => setTimeout(r, 0));
    }
    if(failed) console.warn(`VidaDB: ${failed} registro(s) não gravados em ${storeName}`);
    if(totalInserted > 0) touchTimestamp();
    return totalInserted;
  });
}

// ── TTL: dados de pacientes expiram após 12h (proteção LGPD) ──
const TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
function touchTimestamp(){
  try{ localStorage.setItem(TTL_KEY, String(Date.now())); }catch(e){}
}
function dataExpired(){
  try{
    const ts = parseInt(localStorage.getItem(TTL_KEY) || '0', 10);
    // Sem timestamp = dados legados sem controle de idade → tratar como expirados
    if(!ts) return true;
    return (Date.now() - ts) > TTL_MS;
  }catch(e){ return true; }
}
function clearTimestamp(){
  try{ localStorage.removeItem(TTL_KEY); }catch(e){}
}

// Reconstrói objetos Date a partir dos timestamps
function restoreDates(row){
  if(row._dhTs) row.dh = new Date(row._dhTs);
  else if(typeof row.dh === 'number') row.dh = new Date(row.dh);
  if(row._dhAcolTs) row.dhAcol = new Date(row._dhAcolTs);
  if(row._dhAtendTs) row.dhAtend = new Date(row._dhAtendTs);
  return row;
}

async function getAll(storeName){
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.map(restoreDates));
    req.onerror = () => reject(req.error);
  });
}

async function count(storeName){
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function clear(storeName){
  return _enqueueIdb(async () => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  });
}

async function clearAll(){
  await clear('atendimentos');
  await clear('cid');
  await clear('triagem');
}

async function stats(){
  const [att, cid, tri] = await Promise.all([
    count('atendimentos'), count('cid'), count('triagem')
  ]);
  return { atendimentos: att, cid, triagem: tri };
}

/** Min/max dh nos atendimentos salvos (para resumo na home). */
async function getPeriodBounds(storeName = 'atendimentos') {
  if (!(await count(storeName))) return null;
  const db = await open();
  const readEdge = direction =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).index('dh').openCursor(null, direction);
      req.onsuccess = () => {
        const row = req.result?.value;
        const ts = row?._dhTs ?? row?.dh;
        if (ts == null) { resolve(null); return; }
        resolve(ts instanceof Date ? ts : new Date(ts));
      };
      req.onerror = () => reject(req.error);
    });
  const [min, max] = await Promise.all([readEdge('next'), readEdge('prev')]);
  return min && max ? { min, max } : null;
}

export const VidaDB = { open, bulkPut, getAll, count, clear, clearAll, stats, getPeriodBounds, dataExpired, touchTimestamp, clearTimestamp };
