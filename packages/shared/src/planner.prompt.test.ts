import { describe, expect, it } from 'bun:test';
import { parsePlan, PLAN_SYSTEM_PROMPT } from './planner';

describe('PLAN_SYSTEM_PROMPT: no made-up details', () => {
  it('forbids inventing names and says what to do with a vague goal', () => {
    expect(PLAN_SYSTEM_PROMPT).toContain('Never invent names, numbers, titles');
    expect(PLAN_SYSTEM_PROMPT).toContain('pick one problem');
  });

  it('no longer tells the model to name a specific page or problem', () => {
    expect(PLAN_SYSTEM_PROMPT).not.toContain('Name the specific');
  });

  it('has examples that would pass its own checks', () => {
    const examples = PLAN_SYSTEM_PROMPT.split('\n').filter((line) => line.startsWith('Goal:'));
    expect(examples).toHaveLength(2);
    for (const line of examples) {
      const steps = line
        .split('Steps:')[1]!
        .split(/(?<=\.)\s+/)
        .map((step) => step.trim());
      expect(parsePlan(JSON.stringify({ steps }))).toEqual(steps);
    }
  });
});
