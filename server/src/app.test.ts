import { describe, expect, it } from 'bun:test';
import type { Classification, Classify } from '@tether/shared';
import { createApp } from './app';
import { createRateLimiter } from './guards';

const answer: Classification = {
  category: 'MISSING_KNOWLEDGE',
  suggested_micro_step: 'Open a search tab and type your question.',
};

function makeApp(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  const classify: Classify = async () => answer;
  return createApp({ classify, status: async () => 'ready', ...overrides });
}

function classifyRequest(
  app: ReturnType<typeof makeApp>,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return app.request('/api/classify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const valid = { currentTask: 'File the tax form', blocker: "I don't know which form" };

describe('GET /health', () => {
  it('reports the state of Ollama', async () => {
    const res = await makeApp({ status: async () => 'missing_model' }).request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ollama: 'missing_model' });
  });
});

describe('POST /api/classify', () => {
  it('returns the classification', async () => {
    const res = await classifyRequest(makeApp(), valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(answer);
  });

  it('passes the cleaned request to the classifier', async () => {
    let seen: unknown;
    const app = makeApp({
      classify: async (request) => {
        seen = request;
        return answer;
      },
    });
    await classifyRequest(app, { currentTask: ' Do taxes ', blocker: ' stuck ' });
    expect(seen).toEqual({ currentTask: 'Do taxes', blocker: 'stuck' });
  });

  it('answers a browser extension and allows its origin', async () => {
    const origin = 'chrome-extension://abcdef';
    const res = await classifyRequest(makeApp(), valid, { origin });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('turns away a web page from another site', async () => {
    const res = await classifyRequest(makeApp(), valid, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden_origin' });
  });

  it('lets through a site that was listed', async () => {
    const app = makeApp({ allowedOrigins: ['http://localhost:5173'] });
    const res = await classifyRequest(app, valid, { origin: 'http://localhost:5173' });
    expect(res.status).toBe(200);
  });

  it('rejects a body that is not a valid request', async () => {
    expect((await classifyRequest(makeApp(), { currentTask: 'x' })).status).toBe(400);
    expect((await classifyRequest(makeApp(), 'not json')).status).toBe(400);
  });

  it('rejects a body that is too large', async () => {
    const res = await classifyRequest(makeApp(), { ...valid, blocker: 'x'.repeat(5_000) });
    expect(res.status).toBe(413);
  });

  it('limits how often one client can ask', async () => {
    const app = makeApp({ perClient: createRateLimiter({ limit: 2, windowMs: 60_000 }) });
    expect((await classifyRequest(app, valid)).status).toBe(200);
    expect((await classifyRequest(app, valid)).status).toBe(200);

    const res = await classifyRequest(app, valid);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('limits the total across clients', async () => {
    const app = makeApp({ overall: createRateLimiter({ limit: 1, windowMs: 60_000 }) });
    expect((await classifyRequest(app, valid)).status).toBe(200);
    expect((await classifyRequest(app, valid)).status).toBe(429);
  });

  it('answers 502 when the classifier fails', async () => {
    const app = makeApp({
      classify: async () => {
        throw new Error('model fell over');
      },
    });
    const res = await classifyRequest(app, valid);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'classification_failed' });
  });
});
