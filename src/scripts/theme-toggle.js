// Light/dark toggle. Every .theme-toggle on the page (the bar's and the mobile menu's)
// shares one state. No DOM access at import time; everything is injected.

export const STORAGE_KEY = 'theme';

export function initThemeToggles({ root, buttons, storage }) {
  const isDark = () => root.getAttribute('data-theme') === 'dark';
  const sync = () => buttons.forEach((b) => b.setAttribute('aria-pressed', String(isDark())));

  function toggle() {
    const next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { storage.setItem(STORAGE_KEY, next); } catch {}
    sync();
  }

  sync();
  buttons.forEach((b) => b.addEventListener('click', toggle));
  return { toggle, sync, destroy: () => buttons.forEach((b) => b.removeEventListener('click', toggle)) };
}
