// ui/theme.js — User-triggered theme switching
// setTheme() calls renderAll(), savePrefs(), syncThemeControls() which remain in the script
// block until Tasks 7–9. For now, these are referenced as globals.
// Chart is a CDN global (window.Chart) — not imported.

import { state } from '../state.js';
import { gridColor, tickColor } from './charts.js';

function updateThemeIcon() {
  const icon = document.getElementById('themeBtnIcon');
  if (!icon) return;
  if (state.theme === 'dark') {
    icon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
  } else {
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
}

export function applyTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return;
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  // Chart is a CDN global
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = tickColor();
    Chart.defaults.borderColor = gridColor();
  }
  updateThemeIcon();
}

export function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}
