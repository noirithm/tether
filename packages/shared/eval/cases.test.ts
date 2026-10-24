import { describe, expect, it } from 'bun:test';
import { BLOCKER_CATEGORIES, isBlockerCategory } from '../src';
import { CASES } from './cases';

describe('eval cases', () => {
  it('only use real categories', () => {
    for (const item of CASES) expect(isBlockerCategory(item.category)).toBe(true);
  });

  it('cover every category with at least five cases', () => {
    for (const category of BLOCKER_CATEGORIES) {
      expect(CASES.filter((item) => item.category === category).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('fit the limits the app enforces and are not duplicated', () => {
    const seen = new Set<string>();
    for (const { task, blocker } of CASES) {
      expect(task.length).toBeGreaterThan(0);
      expect(task.length).toBeLessThanOrEqual(200);
      expect(blocker.length).toBeGreaterThan(0);
      expect(blocker.length).toBeLessThanOrEqual(400);
      expect(seen.has(blocker)).toBe(false);
      seen.add(blocker);
    }
  });
});
