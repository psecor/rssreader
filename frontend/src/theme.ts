export type ThemePreference = 'auto' | 'light' | 'dark';

// Must match the inline bootstrap script in public/index.html.
const STORAGE_KEY = 'rssreader.theme';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable (e.g. privacy mode): fall back to auto.
  }
  return 'auto';
}

function applyTheme(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'auto' && systemDark.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function setThemePreference(pref: ThemePreference) {
  try {
    if (pref === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Still apply for this session even if it can't be persisted.
  }
  applyTheme(pref);
}

export function initTheme() {
  applyTheme(getThemePreference());
  systemDark.addEventListener('change', () => applyTheme(getThemePreference()));
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) applyTheme(getThemePreference());
  });
}
