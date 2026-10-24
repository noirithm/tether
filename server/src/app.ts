import { Hono } from 'hono';
import { getConnInfo } from 'hono/bun';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Classify, OllamaStatus } from '@tether/shared';
import { createRateLimiter, isAllowedOrigin, type RateLimiter } from './guards';
import { parseClassifyRequest } from './schema';

const MAX_BODY_BYTES = 4 * 1024;
const CLASSIFY_TIMEOUT_MS = 7_000;

export interface AppOptions {
  classify: Classify;
  status: () => Promise<OllamaStatus>;
  // extra origins allowed to call the API, on top of browser extensions
  allowedOrigins?: readonly string[];
  perClient?: RateLimiter;
  overall?: RateLimiter;
}

function clientKey(c: Parameters<typeof getConnInfo>[0]): string {
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function createApp({
  classify,
  status,
  allowedOrigins = [],
  perClient = createRateLimiter({ limit: 20, windowMs: 60_000 }),
  overall = createRateLimiter({ limit: 120, windowMs: 60_000 }),
}: AppOptions) {
  const app = new Hono();

  // request lines only; what people type about their blockers is never logged
  app.use(logger());

  app.get('/health', async (c) => c.json({ ok: true, ollama: await status() }));

  app.use('/api/*', async (c, next) => {
    if (!isAllowedOrigin(c.req.header('origin'), allowedOrigins)) {
      return c.json({ error: 'forbidden_origin' }, 403);
    }
    await next();
  });

  app.use(
    '/api/*',
    cors({
      origin: (origin) => (origin && isAllowedOrigin(origin, allowedOrigins) ? origin : null),
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['content-type'],
    }),
  );

  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ error: 'too_large' }, 413),
    }),
  );

  app.post('/api/classify', async (c) => {
    const client = perClient.take(clientKey(c));
    const total = overall.take('all');
    if (!client.ok || !total.ok) {
      const wait = Math.max(client.ok ? 0 : client.retryAfterSeconds, total.ok ? 0 : total.retryAfterSeconds);
      c.header('retry-after', String(wait));
      return c.json({ error: 'rate_limited' }, 429);
    }

    const body: unknown = await c.req.json().catch(() => null);
    const request = parseClassifyRequest(body);
    if (!request) return c.json({ error: 'invalid_request' }, 400);

    try {
      const signal = AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(CLASSIFY_TIMEOUT_MS)]);
      return c.json(await classify(request, signal));
    } catch (error) {
      console.error('classify failed:', error instanceof Error ? error.message : error);
      return c.json({ error: 'classification_failed' }, 502);
    }
  });

  return app;
}
