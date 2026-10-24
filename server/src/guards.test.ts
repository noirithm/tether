import { describe, expect, it } from 'bun:test';
import { createRateLimiter, isAllowedOrigin } from './guards';

describe('createRateLimiter', () => {
  it('lets calls through up to the limit, then says how long to wait', () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 10_000, now: () => time });

    expect(limiter.take('a').ok).toBe(true);
    expect(limiter.take('a').ok).toBe(true);

    time = 4_000;
    const blocked = limiter.take('a');
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(6);
  });

  it('counts each key on its own', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10_000, now: () => 0 });
    expect(limiter.take('a').ok).toBe(true);
    expect(limiter.take('b').ok).toBe(true);
    expect(limiter.take('a').ok).toBe(false);
  });

  it('starts a new window once the old one ends', () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 10_000, now: () => time });
    expect(limiter.take('a').ok).toBe(true);
    expect(limiter.take('a').ok).toBe(false);

    time = 10_000;
    expect(limiter.take('a').ok).toBe(true);
  });

  it('forgets old keys instead of growing without end', () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => time });
    for (let i = 0; i < 600; i += 1) limiter.take(`client-${i}`);

    time = 5_000;
    expect(limiter.take('client-0').ok).toBe(true);
  });
});

describe('isAllowedOrigin', () => {
  it('lets requests without an origin through', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it('lets browser extensions through', () => {
    expect(isAllowedOrigin('chrome-extension://abcdef')).toBe(true);
  });

  it('turns away other sites unless they are listed', () => {
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
    expect(isAllowedOrigin('http://localhost:5173', ['http://localhost:5173'])).toBe(true);
    expect(isAllowedOrigin('http://localhost:5174', ['http://localhost:5173'])).toBe(false);
  });
});
