import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARALYSIS_MS, type FrictionEvent } from '@tether/shared';
import { createTelemetrySensor, type TelemetrySensor } from './sensor';

const sensors: TelemetrySensor[] = [];

function setup(paralysisMs?: number) {
  const events: FrictionEvent[] = [];
  const sensor = createTelemetrySensor({
    paralysisMs,
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

  it('flags TAB_ABANDONED immediately when the page is hidden', () => {
    const { sensor, events } = setup();
    sensor.start();
    setHidden(true);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('TAB_ABANDONED');
  });

  it('disarms after the first event', () => {
    const { sensor, events } = setup();
    sensor.start();
    setHidden(true);
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

  it('respects a custom threshold', () => {
    const { sensor, events } = setup(5_000);
    sensor.start();
    vi.advanceTimersByTime(5_000);
    expect(events).toHaveLength(1);
  });
});
