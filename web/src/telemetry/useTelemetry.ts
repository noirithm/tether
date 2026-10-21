import { useEffect, useRef } from 'react';
import type { FrictionEvent } from '@tether/shared';
import { createTelemetrySensor } from './sensor';

export interface UseTelemetryOptions {
  active: boolean;
  onFriction: (event: FrictionEvent) => void;
  // change it to restart the idle clock, e.g. when the step changes
  resetKey?: string | number;
  paralysisMs?: number;
}

export function useTelemetry({ active, onFriction, resetKey, paralysisMs }: UseTelemetryOptions) {
  const handler = useRef(onFriction);
  useEffect(() => {
    handler.current = onFriction;
  });

  useEffect(() => {
    if (!active) return;
    const sensor = createTelemetrySensor({
      paralysisMs,
      onEvent: (event) => handler.current(event),
    });
    sensor.start();
    return () => sensor.stop();
  }, [active, resetKey, paralysisMs]);
}
