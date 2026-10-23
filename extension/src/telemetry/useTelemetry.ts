import { useEffect, useRef } from 'react';
import type { FrictionEvent } from '@tether/shared';
import { createTelemetrySensor, type PageLike } from './sensor';

export interface UseTelemetryOptions {
  active: boolean;
  onFriction: (event: FrictionEvent) => void;
  // where activity and visibility come from; defaults to this page
  source?: PageLike;
  // change it to restart the idle clock, e.g. when the step changes
  resetKey?: string | number;
  paralysisMs?: number;
  // null turns abandonment off
  abandonMs?: number | null;
}

export function useTelemetry({
  active,
  onFriction,
  source,
  resetKey,
  paralysisMs,
  abandonMs,
}: UseTelemetryOptions) {
  const handler = useRef(onFriction);
  useEffect(() => {
    handler.current = onFriction;
  });

  useEffect(() => {
    if (!active) return;
    const sensor = createTelemetrySensor({
      doc: source,
      paralysisMs,
      abandonMs,
      onEvent: (event) => handler.current(event),
    });
    sensor.start();
    return () => sensor.stop();
  }, [active, source, resetKey, paralysisMs, abandonMs]);
}
