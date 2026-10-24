import { describe, expect, it } from 'vitest';
import { BLOCKER_CATEGORIES } from '@tether/shared';
import { FALLBACK_CLASSIFICATION, fallbackFor } from './fallback';

describe('fallbackFor', () => {
  it.each([
    ["I can't remember my password", 'MISSING_CREDENTIAL'],
    ['locked out of the portal', 'MISSING_CREDENTIAL'],
    ["I'm waiting for Sam to reply", 'EXTERNAL_DEPENDENCY'],
    ["they haven't heard back from legal", 'EXTERNAL_DEPENDENCY'],
    ["I don't know where to start looking", 'MISSING_KNOWLEDGE'],
    ['no idea how to do this', 'MISSING_KNOWLEDGE'],
    ['it feels too big and I am anxious', 'EMOTIONAL_OVERWHELM'],
    ["I can't start, I'm exhausted", 'EMOTIONAL_OVERWHELM'],
  ])('reads "%s" as %s', (blocker, category) => {
    expect(fallbackFor(blocker).category).toBe(category);
  });

  it('picks the earlier rule when two match', () => {
    expect(fallbackFor("I'm waiting for access").category).toBe('MISSING_CREDENTIAL');
  });

  it('falls back to the breathing step when nothing matches', () => {
    expect(fallbackFor('ugh')).toEqual(FALLBACK_CLASSIFICATION);
    expect(fallbackFor('')).toEqual(FALLBACK_CLASSIFICATION);
  });

  it('always gives one short, usable step', () => {
    for (const category of BLOCKER_CATEGORIES) {
      const sample = {
        MISSING_CREDENTIAL: 'no password',
        EMOTIONAL_OVERWHELM: 'too much',
        MISSING_KNOWLEDGE: 'no idea',
        EXTERNAL_DEPENDENCY: 'waiting',
      }[category];
      const { suggested_micro_step: step } = fallbackFor(sample);
      expect(step.split(/\s+/).length).toBeLessThanOrEqual(20);
    }
  });
});
