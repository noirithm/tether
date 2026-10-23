const env = import.meta.env;

// the manifest's host_permissions must cover this origin
export const API_URL: string = env.VITE_API_URL ?? 'http://localhost:8787';

// build-time overrides, so the thresholds can be tried without waiting them out:
//   VITE_PARALYSIS_MS=5000 VITE_ABANDON_MS=2000 bun run dev
export const PARALYSIS_MS = Number(env.VITE_PARALYSIS_MS) || undefined;
export const ABANDON_MS = Number(env.VITE_ABANDON_MS) || undefined;