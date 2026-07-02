// utils/dom.js — pure helper functions extracted from the original script block
// NOTE: These are duplicated here intentionally (also exist in the original <script>)
// The original script block will be removed in Tasks 7–9.

/** querySelector shorthand */
export const $ = id => document.getElementById(id);

/** HTML escape */
export const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

/** String normalizer: strips accents, lowercases, collapses non-alphanum to spaces */
export const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Number formatter, PT-BR locale */
export const fmt = n => n == null || Number.isNaN(n) ? "-" : Number(n).toLocaleString("pt-BR");

/** Number formatter with decimal places, PT-BR locale */
export const fmtN = (n, d = 1) => n == null || Number.isNaN(n) ? "-" : Number(n).toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d});

/** Percentage formatter: (n/t)*100 with d decimal places */
export const pct = (n, t, d = 1) => t ? `${fmtN(n / t * 100, d)}%` : "-";

let _shortNameMap = null;

/** Build disambiguated short labels for a list of full names. */
export function buildShortNameLookup(names) {
  const fullList = [...new Map(
    names.map(n => String(n || '').trim()).filter(Boolean).map(n => [norm(n), n])
  ).values()];
  const labelOf = {};
  fullList.forEach(full => {
    const w = full.split(/\s+/).filter(Boolean);
    labelOf[full] = w.slice(0, 2).join(' ') || full;
  });
  const byLabel = {};
  fullList.forEach(full => {
    const lbl = labelOf[full];
    (byLabel[lbl] = byLabel[lbl] || []).push(full);
  });
  Object.values(byLabel).forEach(group => {
    if (group.length <= 1) return;
    group.forEach(full => {
      const w = full.split(/\s+/).filter(Boolean);
      const base = w.slice(0, 2).join(' ');
      labelOf[full] = w.length >= 3 ? `${base} ${w[2].charAt(0)}.` : full;
    });
    const sub = {};
    group.forEach(full => { const l = labelOf[full]; (sub[l] = sub[l] || []).push(full); });
    Object.values(sub).forEach(sg => {
      if (sg.length <= 1) return;
      sg.forEach(full => {
        const w = full.split(/\s+/).filter(Boolean);
        labelOf[full] = w.length >= 3 ? `${w.slice(0, 2).join(' ')} ${w[2]}` : full;
      });
    });
  });
  return new Map(fullList.map(full => [norm(full), labelOf[full]]));
}

export function refreshShortNameMap(names) {
  _shortNameMap = buildShortNameLookup(names);
}

/** Shorten a name to first two words, disambiguated when collisions exist. */
export const shortName = n => {
  const full = String(n || '').trim();
  if (!full) return '';
  if (_shortNameMap?.has(norm(full))) return _shortNameMap.get(norm(full));
  return full.split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
};

/** KPI card HTML builder (pure HTML string, no DOM side-effects) */
export function kpi(label, value, sub, color, trend = "", cls = "", formula = null) {
  const fAttr = formula ? ` data-formula="${JSON.stringify(formula).replace(/"/g, '&quot;')}"` : '';
  const infoBtn = formula ? `<button type="button" class="kpi-info-btn" aria-label="Ver cálculo" onclick="toggleKpiInfo(this)">
<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button>` : '';
  return `<div class="card kpi ${cls}"${fAttr} style="--k:${color}"><div class="kpi-stripe"></div>${infoBtn}<div class="k-label">${esc(label)}</div><div class="k-value">${esc(value)}</div><div class="k-sub">${sub}</div>${trend}<div class="kpi-formula-panel" hidden></div></div>`;
}

/** Primary + compact secondary KPI rows */
export function kpiBoard(primary, secondary = []) {
  const sec = secondary.length
    ? `<div class="kpi-row kpi-row-secondary">${secondary.join('')}</div>`
    : '';
  return `<div class="kpi-board"><div class="kpi-row kpi-row-primary">${primary.join('')}</div>${sec}</div>`;
}

/** Primary tier: larger KPI with optional delta trend. */
export function kpiPrimary(label, value, sub, color, trend = "", formula = null) {
  return kpi(label, value, sub, color, trend, 'kpi-primary', formula);
}

/** Secondary tier: compact supporting KPI. */
export function kpiSecondary(label, value, sub, color, cls = '', formula = null, trend = '') {
  return kpi(label, value, sub, color, trend, `kpi-secondary${cls ? ' ' + cls : ''}`, formula);
}

/** Render primary + secondary KPI tiers into a container (replaces flat grid). */
export function renderKpiTiers(id, primary, secondary = []) {
  const el = $(id);
  if (!el) return;
  el.className = 'kpi-hierarchy';
  el.innerHTML =
    `<div class="grid kpi-tier-primary">${primary.join('')}</div>` +
    (secondary.length ? `<div class="grid kpi-tier-secondary">${secondary.join('')}</div>` : '');
}
