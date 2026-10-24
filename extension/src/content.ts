// Tells the side panel that the user is doing something on this page, and whether
// this tab has focus. It never reads or sends page content.

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

// the type strings must match browserSource.ts (sharing them would split this file into a module)
function send(message: { type: string; focused?: boolean }) {
  try {
    // rejects when the side panel is closed, which is fine
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch {
    // the extension was reloaded underneath this page
  }
}

function pulse() {
  const now = Date.now();
  if (now - lastSent < MIN_GAP_MS) return;
  lastSent = now;
  send({ type: 'tether:pulse' });
}

for (const type of EVENTS) {
  window.addEventListener(type, pulse, { capture: true, passive: true });
}

// Only the top frame reports focus: frames inside it would fight over the answer.
// hasFocus() is true while focus is inside one of those frames, so wait a tick
// for the blur and focus events to settle before reading it.
function reportFocus() {
  if (window !== window.top) return;
  send({ type: 'tether:focus', focused: document.hasFocus() });
}

function reportSoon() {
  setTimeout(reportFocus, 0);
}

window.addEventListener('focus', reportSoon);
window.addEventListener('blur', reportSoon);

// the panel asks for the current state when it opens
chrome.runtime.onMessage.addListener((message: unknown) => {
  if ((message as { type?: unknown } | null)?.type === 'tether:report') reportFocus();
});

reportFocus();

export {};
