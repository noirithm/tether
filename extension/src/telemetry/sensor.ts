import { DEFAULT_ABANDON_MS, DEFAULT_PARALYSIS_MS, type FrictionEvent } from '@tether/shared';

// The part of Document the sensor relies on, so signals can come from elsewhere.
export interface PageLike {
  readonly hidden: boolean;
  // called every time the sensor starts, so a source can mark where the user is now
  anchor?(): void;
  addEventListener(
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListener,
    options?: EventListenerOptions | boolean,
  ): void;
}

export interface TelemetrySensorOptions {
  onEvent: (event: FrictionEvent) => void;
  paralysisMs?: number;
  // null turns abandonment off
  abandonMs?: number | null;
  // set false to keep the current home tab (default true)
  anchor?: boolean;
  now?: () => number;
  doc?: PageLike;
}

export interface TelemetrySensor {
  start(): void;
  stop(): void;
  readonly armed: boolean;
}

export const INPUT_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'wheel',
  'scroll',
  'touchstart',
  'pointerdown',
] as const;

// capture, because scroll doesn't bubble
const LISTENER_OPTS = { capture: true, passive: true } as const;

// Fires at most once, then disarms. Call start() again to re-arm.
export function createTelemetrySensor(options: TelemetrySensorOptions): TelemetrySensor {
  const {
    onEvent,
    paralysisMs = DEFAULT_PARALYSIS_MS,
    abandonMs = DEFAULT_ABANDON_MS,
    anchor = true,
    now = () => performance.now(),
  } = options;
  const doc: PageLike = options.doc ?? document;

  let armed = false;
  let lastInputAt = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined;

  function fire(event: FrictionEvent) {
    if (!armed) return;
    stop();
    onEvent(event);
  }

  function schedule(delay: number) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(check, delay);
  }

  function check() {
    if (!armed || doc.hidden) return;
    const idle = now() - lastInputAt;
    if (idle >= paralysisMs) {
      fire({ kind: 'INPUT_PARALYSIS', at: Date.now(), idleMs: Math.round(idle) });
    } else {
      schedule(paralysisMs - idle);
    }
  }

  // just a timestamp, so a burst of mousemoves stays cheap
  function onInput() {
    lastInputAt = now();
  }

  // A quick look elsewhere isn't abandonment, so the page has to stay hidden
  // for abandonMs. Hidden pages still run timers, just coarsely (about once a
  // second), which is plenty for a threshold in seconds.
  function onVisibility() {
    if (doc.hidden) {
      clearTimeout(idleTimer);
      if (abandonMs !== null) {
        hiddenTimer = setTimeout(() => fire({ kind: 'TAB_ABANDONED', at: Date.now() }), abandonMs);
      }
    } else {
      clearTimeout(hiddenTimer);
      lastInputAt = now();
      schedule(paralysisMs);
    }
  }

  function start() {
    if (armed) return;
    armed = true;
    lastInputAt = now();
    if (anchor) doc.anchor?.();
    for (const type of INPUT_EVENTS) doc.addEventListener(type, onInput, LISTENER_OPTS);
    doc.addEventListener('visibilitychange', onVisibility);
    if (!doc.hidden) schedule(paralysisMs);
  }

  function stop() {
    if (!armed) return;
    armed = false;
    clearTimeout(idleTimer);
    clearTimeout(hiddenTimer);
    idleTimer = undefined;
    hiddenTimer = undefined;
    for (const type of INPUT_EVENTS) doc.removeEventListener(type, onInput, LISTENER_OPTS);
    doc.removeEventListener('visibilitychange', onVisibility);
  }

  return {
    start,
    stop,
    get armed() {
      return armed;
    },
  };
}
