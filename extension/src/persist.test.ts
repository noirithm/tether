import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSession, parseSaved, saveSession } from './persist';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubStorage(initial: Record<string, unknown> = {}) {
  const data = { ...initial };
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) => (key in data ? { [key]: data[key] } : {}),
        set: async (items: Record<string, unknown>) => void Object.assign(data, items),
        remove: async (key: string) => void delete data[key],
      },
    },
  });
  return data;
}

describe('parseSaved', () => {
  it('accepts steps, side quests and the flag', () => {
    expect(
      parseSaved({
        queue: [
          { id: 'a-1', text: 'Look it up.', category: 'MISSING_KNOWLEDGE' },
          { id: 'a-2', text: 'File the form.' },
        ],
        engaged: true,
      }),
    ).toEqual({
      queue: [
        { id: 'a-1', text: 'Look it up.', category: 'MISSING_KNOWLEDGE' },
        { id: 'a-2', text: 'File the form.' },
      ],
      engaged: true,
    });
  });

  it('treats a missing flag as false', () => {
    expect(parseSaved({ queue: [{ id: 'a', text: 'x' }] })?.engaged).toBe(false);
  });

  it.each([
    ['nothing', undefined],
    ['a string', 'queue'],
    ['no queue', {}],
    ['an empty queue', { queue: [] }],
    ['a step with no text', { queue: [{ id: 'a' }] }],
    ['a blank step', { queue: [{ id: 'a', text: '  ' }] }],
    ['a step with no id', { queue: [{ text: 'x' }] }],
    ['an unknown category', { queue: [{ id: 'a', text: 'x', category: 'LAZY' }] }],
    ['a step that is not an object', { queue: ['x'] }],
  ])('rejects %s', (_label, value) => {
    expect(parseSaved(value)).toBeUndefined();
  });
});

describe('loadSession and saveSession', () => {
  it('round-trips through storage', async () => {
    stubStorage();
    await saveSession([{ id: 'a', text: 'Open the form.' }], true);
    expect(await loadSession()).toEqual({ queue: [{ id: 'a', text: 'Open the form.' }], engaged: true });
  });

  it('clears the saved session when no steps are left', async () => {
    const data = stubStorage();
    await saveSession([{ id: 'a', text: 'x' }], false);
    expect(Object.keys(data)).toHaveLength(1);

    await saveSession([], false);
    expect(Object.keys(data)).toHaveLength(0);
    expect(await loadSession()).toBeUndefined();
  });

  it('ignores damaged data', async () => {
    stubStorage({ 'tether:session': { queue: 'nope' } });
    expect(await loadSession()).toBeUndefined();
  });

  it('copes with storage being unavailable or failing', async () => {
    vi.stubGlobal('chrome', undefined);
    expect(await loadSession()).toBeUndefined();
    await expect(saveSession([{ id: 'a', text: 'x' }], false)).resolves.toBeUndefined();

    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async () => {
            throw new Error('boom');
          },
          set: async () => {
            throw new Error('boom');
          },
        },
      },
    });
    expect(await loadSession()).toBeUndefined();
    await expect(saveSession([{ id: 'a', text: 'x' }], false)).resolves.toBeUndefined();
  });
});
