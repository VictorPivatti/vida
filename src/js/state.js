// localStorage key constants
export const RECEP_KEY = 'upa_dash_recepcionados';
export const RECEP_OVERRIDE_KEY = 'upa_dash_recep_override';
export const UC_KEY = 'upa_dash_unit_config';
export const TTL_KEY = 'vida_db_ts';
export const LAYOUT_KEY = 'vida_layout_v1';
export const PREF_KEY = 'upa_dash_prefs';
export const ANOT_KEY = 'upa_dash_anotacoes';

// Application state — single mutable object shared across modules
// triSource: "none" | "hist" | "file"
export const state = {
  raw: [],
  filt: [],
  triRaw: [],
  triFilt: [],
  cidRaw: [],
  cidFilt: [],
  procRaw: [],
  procFilt: [],
  examesRaw: [],
  examesMeta: {},
  charts: {},
  recepOverride: {},
  quality: [],
  files: { hist: '', tri: '', cid: '', proc: '' },
  pending: { tri: null, cid: null, proc: null },
  theme: 'dark',
  triSource: 'none',
  _retCache: null,
  _retCacheKey: -1,
  _filtVersion: 0,
  recepcionados: {},
};

/** Reset all mutable fields to their initial values (used in resetApp). */
export function resetState() {
  state.raw = [];
  state.filt = [];
  state.triRaw = [];
  state.triFilt = [];
  state.cidRaw = [];
  state.cidFilt = [];
  state.procRaw = [];
  state.procFilt = [];
  state.examesRaw = [];
  state.examesMeta = {};
  state.charts = {};
  state.recepOverride = {};
  state.quality = [];
  state.files = { hist: '', tri: '', cid: '', proc: '' };
  state.pending = { tri: null, cid: null, proc: null };
  state.theme = 'dark';
  state.triSource = 'none';
  state._retCache = null;
  state._retCacheKey = -1;
  state._filtVersion = 0;
  state.recepcionados = {};
}
