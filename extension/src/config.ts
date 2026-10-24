import { OLLAMA_MODEL, OLLAMA_URL } from '@tether/shared';

const env = import.meta.env;

// the manifest's host_permissions and the rule in background.ts must cover this address
export const OLLAMA = {
  baseUrl: OLLAMA_URL,
  model: env.VITE_OLLAMA_MODEL || OLLAMA_MODEL,
};

// build-time overrides, so the thresholds can be tried without waiting them out:
//   VITE_PARALYSIS_MS=5000 VITE_ABANDON_MS=2000 bun run dev
export const PARALYSIS_MS = Number(env.VITE_PARALYSIS_MS) || undefined;
export const ABANDON_MS = Number(env.VITE_ABANDON_MS) || undefined;
