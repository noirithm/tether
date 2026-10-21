import { DEFAULT_PARALYSIS_MS, type FrictionEvent } from '@tether/shared';

export interface TelemetrySensorOptions {
  onEvent: (event: FrictionEvent) => void;
  paralysisMs?: number;
  now?: () => number;
  doc?: Document;
}

export interface TelemetrySensor {
  start(): void;
  stop(): void;
  readonly armed: boolean;
}

const INPUT_EVENTS = [
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
    now = () => performance.now(),
    doc = document,
  } = options;

  let armed = false;
  let lastInputAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function fire(event: FrictionEvent) {
    if (!armed) return;
    stop();
    onEvent(event);
  }

  function schedule(delay: number) {
    clearTimeout(timer);
    timer = setTimeout(check, delay);
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

  // background tabs throttle timers, so abandonment can't wait on one
  function onVisibility() {
    if (doc.hidden) {
      fire({ kind: 'TAB_ABANDONED', at: Date.now() });
    } else {
      lastInputAt = now();
      schedule(paralysisMs);
    }
  }

  function start() {
    if (armed) return;
    armed = true;
    lastInputAt = now();
    for (const type of INPUT_EVENTS) doc.addEventListener(type, onInput, LISTENER_OPTS);
    doc.addEventListener('visibilitychange', onVisibility);
    if (!doc.hidden) schedule(paralysisMs);
  }

  function stop() {
    if (!armed) return;
    armed = false;
    clearTimeout(timer);
    timer = undefined;
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
