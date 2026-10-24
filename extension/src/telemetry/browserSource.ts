import { INPUT_EVENTS, type PageLike } from './sensor';

// these must match content.ts
const PULSE = 'tether:pulse';
const FOCUS = 'tether:focus';
const REPORT = 'tether:report';

// any entry in INPUT_EVENTS counts as activity; this is the stand-in for a page ping
const ACTIVITY: (typeof INPUT_EVENTS)[number] = 'pointerdown';

const PANEL = 'panel';

export interface BrowserSource extends PageLike {
  // while locked, using the panel no longer makes the current tab home
  lockHome(locked: boolean): void;
  dispose(): void;
}

interface Message {
  type?: unknown;
  focused?: unknown;
}

// "hidden" means the user isn't looking at the page they started on: either
// nothing in the browser has focus, or a different tab is in front.
// Focus is tracked per tab, so a blur from the old tab arriving after the focus
// from the new one can't leave the source stuck on hidden.
export function createBrowserSource(): BrowserSource {
  const target = new EventTarget();
  const focused = new Set<number | typeof PANEL>();
  let hidden = false;
  let activeTab: number | undefined;
  // the tab the user was on when the current step started
  let homeTab: number | undefined;
  let homeLocked = false;

  function pulse() {
    target.dispatchEvent(new Event(ACTIVITY));
  }

  function update() {
    const elsewhere = homeTab !== undefined && activeTab !== undefined && activeTab !== homeTab;
    const next = focused.size === 0 || elsewhere;
    if (next === hidden) return;
    hidden = next;
    target.dispatchEvent(new Event('visibilitychange'));
  }

  function setFocused(id: number | typeof PANEL, value: boolean) {
    if (value) focused.add(id);
    else focused.delete(id);
    update();
  }

  function setActive(tabId: number) {
    activeTab = tabId;
    homeTab ??= tabId;
    update();
  }

  function onMessage(message: unknown, sender: chrome.runtime.MessageSender) {
    const { type, focused: isFocused } = (message ?? {}) as Message;
    const tabId = sender.tab?.id;
    if (type === PULSE) {
      pulse();
    } else if (type === FOCUS && tabId !== undefined) {
      if (isFocused === true) {
        activeTab = tabId;
        homeTab ??= tabId;
      }
      setFocused(tabId, isFocused === true);
    }
  }

  const onActivated = (info: { tabId: number }) => setActive(info.tabId);

  function onTabClosed(tabId: number) {
    // Chrome may report the new active tab before or after the old one closes
    if (homeTab === tabId) homeTab = activeTab !== tabId ? activeTab : undefined;
    if (activeTab === tabId) activeTab = undefined;
    setFocused(tabId, false);
  }

  // using the panel means the user is here, so wherever they are now is home
  function onPanelFocus() {
    if (!homeLocked) homeTab = activeTab ?? homeTab;
    setFocused(PANEL, true);
  }

  const onPanelBlur = () => setFocused(PANEL, false);

  if (document.hasFocus()) focused.add(PANEL);

  chrome.runtime.onMessage.addListener(onMessage);
  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onRemoved.addListener(onTabClosed);
  window.addEventListener('focus', onPanelFocus);
  window.addEventListener('blur', onPanelBlur);
  // input inside the panel itself counts too
  for (const type of INPUT_EVENTS) {
    document.addEventListener(type, pulse, { capture: true, passive: true });
  }

  // pages only report changes, so learn which tab is in front and ask it for its focus
  chrome.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => {
      for (const tab of tabs) {
        if (tab.id === undefined) continue;
        if (activeTab === undefined) setActive(tab.id);
        chrome.tabs.sendMessage(tab.id, { type: REPORT }).catch(() => {});
      }
    })
    .catch(() => {});

  return {
    get hidden() {
      return hidden;
    },
    anchor() {
      homeTab = activeTab;
      // leaving the home tab is over, but never turn "unknown" into "away"
      const away = hidden && focused.size === 0;
      if (away === hidden) return;
      hidden = away;
      target.dispatchEvent(new Event('visibilitychange'));
    },
    lockHome(locked) {
      homeLocked = locked;
    },
    addEventListener: (type, listener, options) =>
      target.addEventListener(type, listener, options),
    removeEventListener: (type, listener, options) =>
      target.removeEventListener(type, listener, options),
    dispose() {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onRemoved.removeListener(onTabClosed);
      window.removeEventListener('focus', onPanelFocus);
      window.removeEventListener('blur', onPanelBlur);
      for (const type of INPUT_EVENTS) {
        document.removeEventListener(type, pulse, { capture: true });
      }
    },
  };
}
