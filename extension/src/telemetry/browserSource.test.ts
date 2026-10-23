import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ABANDON_MS, DEFAULT_PARALYSIS_MS, type FrictionEvent } from '@tether/shared';
import { createBrowserSource } from './browserSource';
import { createTelemetrySensor } from './sensor';

type Sender = { tab?: { id?: number } };
type MessageListener = (message: unknown, sender: Sender) => void;
type TabListener = (tabId: number) => void;
type ActivatedListener = (info: { tabId: number }) => void;

function stubChrome(activeTabs: number[]) {
  const messageListeners = new Set<MessageListener>();
  const activatedListeners = new Set<ActivatedListener>();
  const removedListeners = new Set<TabListener>();
  const asked: number[] = [];

  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: (listener: MessageListener) => {
          messageListeners.add(listener);
        },
        removeListener: (listener: MessageListener) => {
          messageListeners.delete(listener);
        },
      },
    },
    tabs: {
      onActivated: {
        addListener: (listener: ActivatedListener) => {
          activatedListeners.add(listener);
        },
        removeListener: (listener: ActivatedListener) => {
          activatedListeners.delete(listener);
        },
      },
      onRemoved: {
        addListener: (listener: TabListener) => {
          removedListeners.add(listener);
        },
        removeListener: (listener: TabListener) => {
          removedListeners.delete(listener);
        },
      },
      query: async () => activeTabs.map((id) => ({ id })),
      sendMessage: async (tabId: number) => {
        asked.push(tabId);
      },
    },
  });

  function from(tabId: number | undefined, message: unknown) {
    const sender: Sender = tabId === undefined ? {} : { tab: { id: tabId } };
    messageListeners.forEach((listener) => listener(message, sender));
  }

  return {
    asked,
    send: from,
    pulse: (tabId: number) => from(tabId, { type: 'tether:pulse' }),
    focus: (tabId: number, focused: boolean) => from(tabId, { type: 'tether:focus', focused }),
    activate: (tabId: number) => activatedListeners.forEach((listener) => listener({ tabId })),
    closeTab: (tabId: number) => removedListeners.forEach((listener) => listener(tabId)),
    listeners: () => messageListeners.size + activatedListeners.size + removedListeners.size,
  };
}

const cleanups: Array<() => void> = [];

async function arm(options: { panelFocused?: boolean; activeTabs?: number[] } = {}) {
  vi.spyOn(document, 'hasFocus').mockReturnValue(options.panelFocused ?? false);
  const browser = stubChrome(options.activeTabs ?? []);
  const source = createBrowserSource();
  const events: FrictionEvent[] = [];
  const sensor = createTelemetrySensor({
    doc: source,
    now: () => Date.now(),
    onEvent: (event) => events.push(event),
  });
  sensor.start();
  cleanups.push(() => {
    sensor.stop();
    source.dispose();
  });
  await vi.advanceTimersByTimeAsync(0);
  return { browser, source, sensor, events };
}

// the user was on tab 1 and moved to tab 2
function moveToSecondTab(browser: ReturnType<typeof stubChrome>) {
  browser.activate(2);
  browser.focus(1, false);
  browser.focus(2, true);
}

describe('createBrowserSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('treats a ping from a page as activity', async () => {
    const { browser, events } = await arm();
    vi.advanceTimersByTime(30_000);
    browser.pulse(1);
    vi.advanceTimersByTime(DEFAULT_PARALYSIS_MS - 1);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('INPUT_PARALYSIS');
  });

  it('ignores messages that are not pings', async () => {
    const { browser, events } = await arm();
    vi.advanceTimersByTime(30_000);
    browser.send(1, { type: 'something-else' });
    browser.send(undefined, null);
    vi.advanceTimersByTime(15_000);
    expect(events).toHaveLength(1);
  });

  it('counts input inside the panel itself', async () => {
    const { events } = await arm();
    vi.advanceTimersByTime(30_000);
    document.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(DEFAULT_PARALYSIS_MS - 1);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events).toHaveLength(1);
  });

  it('flags abandonment once no page has focus for long enough', async () => {
    const { browser, source, events } = await arm();
    browser.focus(1, true);
    browser.focus(1, false);
    expect(source.hidden).toBe(true);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS - 1);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('TAB_ABANDONED');
  });

  it('knows from the start when the panel has focus', async () => {
    const { source, events } = await arm({ panelFocused: true });
    window.dispatchEvent(new Event('blur'));
    expect(source.hidden).toBe(true);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS);
    expect(events[0]?.kind).toBe('TAB_ABANDONED');
  });

  it('flags abandonment when the user stays on a different tab', async () => {
    const { browser, source, events } = await arm({ activeTabs: [1] });
    browser.focus(1, true);
    moveToSecondTab(browser);
    expect(source.hidden).toBe(true);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS - 1);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('TAB_ABANDONED');
  });

  it('ignores a quick trip to another tab', async () => {
    const { browser, source, events } = await arm({ activeTabs: [1] });
    browser.focus(1, true);
    moveToSecondTab(browser);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS - 1);
    browser.activate(1);
    browser.focus(1, true);
    browser.focus(2, false);
    expect(source.hidden).toBe(false);
    vi.advanceTimersByTime(DEFAULT_PARALYSIS_MS - 1);
    expect(events).toHaveLength(0);
  });

  it('is not left stuck on hidden when focus reports arrive late', async () => {
    const lateBlur = await arm({ activeTabs: [1] });
    lateBlur.browser.focus(1, true);
    moveToSecondTab(lateBlur.browser);
    lateBlur.browser.activate(1);
    lateBlur.browser.focus(1, true);
    lateBlur.browser.focus(2, false);
    expect(lateBlur.source.hidden).toBe(false);

    const earlyBlur = await arm({ activeTabs: [1] });
    earlyBlur.browser.focus(1, true);
    moveToSecondTab(earlyBlur.browser);
    earlyBlur.browser.focus(2, false);
    earlyBlur.browser.activate(1);
    earlyBlur.browser.focus(1, true);
    expect(earlyBlur.source.hidden).toBe(false);
  });

  it('takes the tab in front as home when a new step starts', async () => {
    const { browser, source, sensor, events } = await arm({ activeTabs: [1] });
    browser.focus(1, true);
    moveToSecondTab(browser);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS - 1);

    sensor.stop();
    sensor.start();
    expect(source.hidden).toBe(false);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS * 2);
    expect(events).toHaveLength(0);
  });

  it('treats using the panel as being present, wherever the user is', async () => {
    const { browser, source, events } = await arm({ activeTabs: [1] });
    browser.focus(1, true);
    moveToSecondTab(browser);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS - 1);

    window.dispatchEvent(new Event('focus'));
    expect(source.hidden).toBe(false);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS * 2);
    expect(events).toHaveLength(0);
  });

  it('does not treat closing the home tab as leaving', async () => {
    const { browser, source, events } = await arm({ activeTabs: [1] });
    browser.focus(1, true);
    moveToSecondTab(browser);
    expect(source.hidden).toBe(true);

    browser.closeTab(1);
    expect(source.hidden).toBe(false);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS * 3);
    expect(events).toHaveLength(0);
  });

  it('does not let a closed tab keep the browser looking focused', async () => {
    const { browser, events } = await arm();
    browser.focus(1, true);
    browser.closeTab(1);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS);
    expect(events[0]?.kind).toBe('TAB_ABANDONED');
  });

  it('does not treat a click from the page into the panel as leaving', async () => {
    const { browser, source, events } = await arm();
    browser.focus(1, true);
    browser.focus(1, false);
    window.dispatchEvent(new Event('focus'));
    expect(source.hidden).toBe(false);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS * 3);
    expect(events).toHaveLength(0);
  });

  it('ignores a background tab that reports it has no focus', async () => {
    const { browser, source } = await arm();
    browser.focus(1, true);
    browser.focus(2, false);
    expect(source.hidden).toBe(false);
  });

  it('asks the tab in front where focus is when it starts', async () => {
    const { browser } = await arm({ activeTabs: [4] });
    expect(browser.asked).toEqual([4]);
  });

  it('stops listening once disposed', async () => {
    const { browser, source } = await arm({ panelFocused: true });
    expect(browser.listeners()).toBe(3);
    source.dispose();
    expect(browser.listeners()).toBe(0);
    window.dispatchEvent(new Event('blur'));
    expect(source.hidden).toBe(false);
  });
});
