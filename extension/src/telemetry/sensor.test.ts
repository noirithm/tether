import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ABANDON_MS, DEFAULT_PARALYSIS_MS, type FrictionEvent } from '@tether/shared';
import { createTelemetrySensor, type TelemetrySensor } from './sensor';

const sensors: TelemetrySensor[] = [];

function setup(thresholds: { paralysisMs?: number; abandonMs?: number } = {}) {
  const events: FrictionEvent[] = [];
  const sensor = createTelemetrySensor({
    ...thresholds,
    now: () => Date.now(),
    onEvent: (e) => events.push(e),
  });
  sensors.push(sensor);
  return { sensor, events };
}

function mockHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
}

function setHidden(hidden: boolean) {
  mockHidden(hidden);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('createTelemetrySensor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    sensors.splice(0).forEach((s) => s.stop());
    Reflect.deleteProperty(document, 'hidden');
    vi.useRealTimers();
  });

  it('flags INPUT_PARALYSIS after 45s of silence', () => {
    const { sensor, events } = setup();
    sensor.start();
    vi.advanceTimersByTime(DEFAULT_PARALYSIS_MS - 1);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'INPUT_PARALYSIS', idleMs: DEFAULT_PARALYSIS_MS });
  });

  it('resets the idle clock on input', () => {
    const { sensor, events } = setup();
    sensor.start();
    vi.advanceTimersByTime(30_000);
    document.dispatchEvent(new Event('mousemove'));
    vi.advanceTimersByTime(44_999);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events).toHaveLength(1);
  });

  it('counts non-bubbling scroll events from any element', () => {
    const { sensor, events } = setup();
    const el = document.createElement('div');
    document.body.append(el);
    sensor.start();
    vi.advanceTimersByTime(30_000);
    el.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(44_999);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events).toHaveLength(1);
    el.remove();
  });

  it('flags TAB_ABANDONED once the tab has stayed hidden long enough', () => {
    const { sensor, events } = setup();
    sensor.start();
    setHidden(true);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS - 1);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('TAB_ABANDONED');
  });

  it('ignores a quick trip to another tab', () => {
    const { sensor, events } = setup();
    sensor.start();
    setHidden(true);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS - 1);
    setHidden(false);
    vi.advanceTimersByTime(DEFAULT_PARALYSIS_MS - 1);
    expect(events).toHaveLength(0);
  });

  it('starts a fresh idle window when the user comes back', () => {
    const { sensor, events } = setup();
    sensor.start();
    vi.advanceTimersByTime(40_000);
    setHidden(true);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS - 1);
    setHidden(false);
    vi.advanceTimersByTime(DEFAULT_PARALYSIS_MS - 1);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('INPUT_PARALYSIS');
  });

  it('disarms after the first event', () => {
    const { sensor, events } = setup();
    sensor.start();
    setHidden(true);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS);
    vi.advanceTimersByTime(DEFAULT_PARALYSIS_MS * 3);
    expect(events).toHaveLength(1);
    expect(sensor.armed).toBe(false);
  });

  it('emits nothing before start() or after stop()', () => {
    const { sensor, events } = setup();
    vi.advanceTimersByTime(DEFAULT_PARALYSIS_MS * 2);
    setHidden(true);
    setHidden(false);
    sensor.start();
    sensor.stop();
    vi.advanceTimersByTime(DEFAULT_PARALYSIS_MS * 2);
    setHidden(true);
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS * 2);
    expect(events).toHaveLength(0);
  });

  it('cancels a pending abandonment when stopped', () => {
    const { sensor, events } = setup();
    sensor.start();
    setHidden(true);
    sensor.stop();
    vi.advanceTimersByTime(DEFAULT_ABANDON_MS * 2);
    expect(events).toHaveLength(0);
  });

  it('does not count idle time while started on a hidden page', () => {
    const { sensor, events } = setup();
    mockHidden(true);
    sensor.start();
    vi.advanceTimersByTime(120_000);
    expect(events).toHaveLength(0);
    setHidden(false);
    vi.advanceTimersByTime(DEFAULT_PARALYSIS_MS);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('INPUT_PARALYSIS');
  });

  it('respects custom thresholds', () => {
    const idle = setup({ paralysisMs: 5_000 });
    idle.sensor.start();
    vi.advanceTimersByTime(5_000);
    expect(idle.events).toHaveLength(1);

    const away = setup({ abandonMs: 2_000 });
    away.sensor.start();
    setHidden(true);
    vi.advanceTimersByTime(2_000);
    expect(away.events).toHaveLength(1);
    expect(away.events[0]?.kind).toBe('TAB_ABANDONED');
  });
});

describe('createTelemetrySensor with a source that anchors', () => {
  it('lets the source mark where the user is on every start', () => {
    const anchor = vi.fn();
    const sensor = createTelemetrySensor({
      doc: { hidden: false, anchor, addEventListener() {}, removeEventListener() {} },
      onEvent: () => {},
    });
    sensor.start();
    sensor.stop();
    sensor.start();
    sensor.stop();
    expect(anchor).toHaveBeenCalledTimes(2);
  });
});
