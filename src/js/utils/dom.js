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

/** Shorten a name to first two words */
export const shortName = n => String(n || "").split(/\s+/).filter(Boolean).slice(0, 2).join(" ");

/** KPI card HTML builder (pure HTML string, no DOM side-effects) */
export function kpi(label, value, sub, color, trend = "", cls = "", formula = null) {
  const fAttr = formula ? ` data-formula="${JSON.stringify(formula).replace(/"/g, '&quot;')}"` : '';
  const infoBtn = formula ? `<button type="button" class="kpi-info-btn" aria-label="Ver cálculo" onclick="toggleKpiInfo(this)">
<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button>` : '';
  return `<div class="card kpi ${cls}"${fAttr} style="--k:${color}"><div class="kpi-stripe"></div>${infoBtn}<div class="k-label">${esc(label)}</div><div class="k-value">${esc(value)}</div><div class="k-sub">${sub}</div>${trend}<div class="kpi-formula-panel" hidden></div></div>`;
}
