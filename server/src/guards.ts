export interface RateLimiter {
  take(key: string): { ok: boolean; retryAfterSeconds: number };
}

interface Options {
  limit: number;
  windowMs: number;
  now?: () => number;
}

// Fixed window counter, kept in memory. Fine for one process.
export function createRateLimiter({ limit, windowMs, now = Date.now }: Options): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  function sweep(at: number) {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= at) windows.delete(key);
    }
  }

  return {
    take(key) {
      const at = now();
      if (windows.size > 500) sweep(at);

      let entry = windows.get(key);
      if (!entry || entry.resetAt <= at) {
        entry = { count: 0, resetAt: at + windowMs };
        windows.set(key, entry);
      }

      entry.count += 1;
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - at) / 1000));
      return { ok: entry.count <= limit, retryAfterSeconds };
    },
  };
}

// Requests without an Origin (curl, the tests) pass. A browser page on any other
// site is turned away, so a stranger's web page can't use this server.
export function isAllowedOrigin(origin: string | undefined, extra: readonly string[] = []): boolean {
  if (!origin) return true;
  return origin.startsWith('chrome-extension://') || extra.includes(origin);
}
