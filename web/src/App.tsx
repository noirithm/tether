import { useState } from 'react';
import type { FrictionEvent } from '@tether/shared';
import { useTelemetry } from './telemetry';

// ?paralysis=5000 shortens the idle window for manual testing
const paralysisMs = Number(new URLSearchParams(location.search).get('paralysis')) || undefined;

export function App() {
  const [active, setActive] = useState(false);
  const [last, setLast] = useState<FrictionEvent | null>(null);

  useTelemetry({
    active,
    paralysisMs,
    onFriction: (event) => {
      setLast(event);
      setActive(false);
    },
  });

  return (
    <main className="harness">
      <p>{active ? 'armed. Hold still, or switch tabs.' : 'sensor idle'}</p>
      <button
        disabled={active}
        onClick={() => {
          setLast(null);
          setActive(true);
        }}
      >
        arm sensor
      </button>
      {last && <pre>{JSON.stringify(last, null, 2)}</pre>}
    </main>
  );
}
