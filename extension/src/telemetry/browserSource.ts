import { INPUT_EVENTS, type PageLike } from './sensor';

// must match content.ts
const PULSE = 'tether:pulse';

// any entry in INPUT_EVENTS counts as activity; this is the stand-in for a page ping
const ACTIVITY: (typeof INPUT_EVENTS)[number] = 'pointerdown';

export interface BrowserSource extends PageLike {
  dispose(): void;
}

// "hidden" means no browser window has focus. Switching tabs doesn't count,
// because the side panel stays in view across tabs.
export function createBrowserSource(): BrowserSource {
  const target = new EventTarget();
  let hidden = false;

  function pulse() {
    target.dispatchEvent(new Event(ACTIVITY));
  }

  function onMessage(message: unknown) {
    if ((message as { type?: unknown } | null)?.type === PULSE) pulse();
  }

  function onFocus(windowId: number) {
    const next = windowId === chrome.windows.WINDOW_ID_NONE;
    if (next === hidden) return;
    hidden = next;
    target.dispatchEvent(new Event('visibilitychange'));
  }

  chrome.runtime.onMessage.addListener(onMessage);
  chrome.windows.onFocusChanged.addListener(onFocus);
  // input inside the panel itself counts too
  for (const type of INPUT_EVENTS) {
    document.addEventListener(type, pulse, { capture: true, passive: true });
  }

  return {
    get hidden() {
      return hidden;
    },
    addEventListener: (type, listener, options) =>
      target.addEventListener(type, listener, options),
    removeEventListener: (type, listener, options) =>
      target.removeEventListener(type, listener, options),
    dispose() {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.windows.onFocusChanged.removeListener(onFocus);
      for (const type of INPUT_EVENTS) {
        document.removeEventListener(type, pulse, { capture: true });
      }
    },
  };
}
