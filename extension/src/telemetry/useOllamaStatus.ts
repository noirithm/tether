import { useEffect, useState } from 'react';
import { ollamaStatus, type OllamaStatus } from '@tether/shared';
import { OLLAMA } from '../config';

// checks Ollama each time `active` turns on
export function useOllamaStatus(active: boolean): OllamaStatus | undefined {
  const [status, setStatus] = useState<OllamaStatus>();

  useEffect(() => {
    if (!active) return;
    let current = true;
    ollamaStatus(OLLAMA).then((next) => {
      if (current) setStatus(next);
    });
    return () => {
      current = false;
    };
  }, [active]);

  return status;
}
