import { refreshLucide } from './icons.js';

const THEME_KEY = 'awaaz_theme';
const DARK = 'dark';
const LIGHT = 'light';

export function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? LIGHT : DARK;
}

export function getSavedTheme() {
  return localStorage.getItem(THEME_KEY);
}

/**
 * @param {string} theme
 * @param {{ persist?: boolean }} [opts]
 */
export function applyTheme(theme, opts = {}) {
  const { persist = false } = opts;
  const html = document.documentElement;
  if (theme === LIGHT) {
    html.setAttribute('data-theme', 'light');
  } else {
    html.removeAttribute('data-theme');
  }
  if (persist) {
    localStorage.setItem(THEME_KEY, theme);
  }
  refreshLucide();
}

export function initTheme() {
  const saved = getSavedTheme();
  const initial = saved || getSystemTheme();
  applyTheme(initial, { persist: Boolean(saved) });

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    applyTheme(isLight ? DARK : LIGHT, { persist: true });
  });

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (getSavedTheme()) return;
    applyTheme(e.matches ? LIGHT : DARK, { persist: false });
  });
}
