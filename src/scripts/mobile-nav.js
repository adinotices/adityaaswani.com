// Mobile menu behaviour. No DOM access at import time; everything is injected.

export function initMobileNav({ header, button, panel, mql, doc }) {
  const isOpen = () => header.hasAttribute('data-menu-open');

  function open() {
    header.setAttribute('data-menu-open', '');
    button.setAttribute('aria-expanded', 'true');
    const first = panel.querySelector('a');
    if (first) first.focus();
  }

  // restoreFocus sends focus back to the button (keyboard close); otherwise focus is left alone.
  function close({ restoreFocus = false } = {}) {
    if (!isOpen()) return;
    header.removeAttribute('data-menu-open');
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
  }

  function toggle() {
    if (isOpen()) close({ restoreFocus: true });
    else open();
  }

  const onButton = () => toggle();
  const onKey = (e) => { if (e.key === 'Escape' && isOpen()) close({ restoreFocus: true }); };
  // Links close the menu without moving focus so hash links still scroll.
  const onPanelClick = (e) => {
    const t = e.target;
    if (t && typeof t.closest === 'function' ? t.closest('a') : t && t.tagName === 'A') close();
  };
  const onDocClick = (e) => { if (!header.contains(e.target)) close(); };
  // Focus leaving the panel (other than to the toggle) closes it, e.g. Tab past the last link.
  const onFocusOut = (e) => {
    const next = e.relatedTarget;
    if (next && next !== button && !panel.contains(next)) close();
  };
  const onMql = (e) => { if (!e.matches) close(); };

  button.addEventListener('click', onButton);
  panel.addEventListener('click', onPanelClick);
  panel.addEventListener('focusout', onFocusOut);
  button.addEventListener('focusout', onFocusOut);
  doc.addEventListener('keydown', onKey);
  doc.addEventListener('click', onDocClick);
  mql.addEventListener('change', onMql);

  function destroy() {
    button.removeEventListener('click', onButton);
    panel.removeEventListener('click', onPanelClick);
    panel.removeEventListener('focusout', onFocusOut);
    button.removeEventListener('focusout', onFocusOut);
    doc.removeEventListener('keydown', onKey);
    doc.removeEventListener('click', onDocClick);
    mql.removeEventListener('change', onMql);
  }

  return { open, close, toggle, isOpen, destroy };
}
