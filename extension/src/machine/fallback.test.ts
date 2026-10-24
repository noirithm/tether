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
    ['reels', 'DISTRACTION'],
    ['I keep watching Reels', 'DISTRACTION'],
    ['stuck scrolling on my phone', 'DISTRACTION'],
    ['opened YouTube for a second', 'DISTRACTION'],
    ["I'm so distracted today", 'DISTRACTION'],
  ])('reads "%s" as %s', (blocker, category) => {
    expect(fallbackFor(blocker).category).toBe(category);
  });

  it('picks the earlier rule when two match', () => {
    expect(fallbackFor("I'm waiting for access").category).toBe('MISSING_CREDENTIAL');
    expect(fallbackFor("I don't know how to stop scrolling").category).toBe('DISTRACTION');
  });

  it('falls back to the breathing step when nothing matches', () => {
    expect(fallbackFor('ugh')).toEqual(FALLBACK_CLASSIFICATION);
    expect(fallbackFor('')).toEqual(FALLBACK_CLASSIFICATION);
  });

  it('never sends someone who is distracted to go and look something up', () => {
    const { suggested_micro_step: step } = fallbackFor('reels');
    expect(step).not.toMatch(/search|tab and type|look up/i);
  });

  it('always gives one short, usable step', () => {
    const samples: Record<(typeof BLOCKER_CATEGORIES)[number], string> = {
      MISSING_CREDENTIAL: 'no password',
      EMOTIONAL_OVERWHELM: 'too much',
      MISSING_KNOWLEDGE: 'no idea',
      EXTERNAL_DEPENDENCY: 'waiting',
      DISTRACTION: 'reels',
    };
    for (const category of BLOCKER_CATEGORIES) {
      const result = fallbackFor(samples[category]);
      expect(result.category).toBe(category);
      expect(result.suggested_micro_step.split(/\s+/).length).toBeLessThanOrEqual(20);
    }
  });
});
