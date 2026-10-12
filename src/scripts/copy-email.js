// Copy-to-clipboard buttons next to email addresses. No DOM access at import time; everything is injected.

const COPIED = 'Copied';
const FAILED = 'Copy failed. Select the address instead.';
const IDLE = 'Copy';

// Resolves true if the clipboard accepted the text, false otherwise. Never throws.
export async function copyText(text, clipboard) {
  if (!clipboard || typeof clipboard.writeText !== 'function') return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Wires every [data-copy] button under root. Buttons stay hidden unless the clipboard API exists,
// so the no-JS and unsupported-browser cases show nothing broken. Returns the number of buttons wired.
export function initCopyButtons({
  root,
  clipboard,
  setTimeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
  resetMs = 2000,
}) {
  if (typeof clipboard?.writeText !== 'function') return 0;

  const buttons = Array.from(root.querySelectorAll('[data-copy]'));
  const pendingReset = new Map(); // button -> timer handle, so rapid clicks leave one reset pending
  const lookup = (id) => (root.getElementById ? root.getElementById(id) : root.querySelector('#' + id));

  for (const button of buttons) {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const ok = await copyText(button.dataset.copy, clipboard);
      const status = button.dataset.status ? lookup(button.dataset.status) : null;
      const label = button.querySelector('.copy-label');

      if (pendingReset.has(button)) clearTimeout(pendingReset.get(button));

      if (status) status.textContent = ok ? COPIED : FAILED;
      if (label) label.textContent = ok ? COPIED : IDLE;

      const handle = setTimeout(() => {
        pendingReset.delete(button);
        if (status) status.textContent = '';
        if (label) label.textContent = IDLE;
      }, resetMs);
      pendingReset.set(button, handle);
    });
  }

  return buttons.length;
}
