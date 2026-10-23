// Tells the side panel that the user is doing something on this page.
// It sends a bare timestamp-free ping and never reads or sends page content.

const EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'wheel',
  'scroll',
  'touchstart',
  'pointerdown',
] as const;

const MIN_GAP_MS = 2_000;
let lastSent = 0;

function pulse() {
  const now = Date.now();
  if (now - lastSent < MIN_GAP_MS) return;
  lastSent = now;
  try {
    // rejects when the side panel is closed, which is fine
    // (the type string must match browserSource.ts; sharing it would split this file into a module)
    chrome.runtime.sendMessage({ type: 'tether:pulse' }).catch(() => {});
  } catch {
    // the extension was reloaded underneath this page
  }
}

for (const type of EVENTS) {
  window.addEventListener(type, pulse, { capture: true, passive: true });
}

export {};
