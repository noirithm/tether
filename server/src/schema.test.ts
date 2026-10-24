import { describe, expect, it } from 'bun:test';
import { MAX_BLOCKER_LENGTH, MAX_TASK_LENGTH, parseClassifyRequest } from './schema';

describe('parseClassifyRequest', () => {
  it('trims and returns a valid request', () => {
    expect(parseClassifyRequest({ currentTask: ' Do taxes ', blocker: ' no login ' })).toEqual({
      currentTask: 'Do taxes',
      blocker: 'no login',
    });
  });

  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['a missing blocker', { currentTask: 'x' }],
    ['a number for the task', { currentTask: 1, blocker: 'x' }],
    ['a blank task', { currentTask: '  ', blocker: 'x' }],
    ['a blank blocker', { currentTask: 'x', blocker: '' }],
  ])('rejects %s', (_label, body) => {
    expect(parseClassifyRequest(body)).toBeNull();
  });

  it('rejects text over the limits and accepts text at them', () => {
    const at = { currentTask: 'a'.repeat(MAX_TASK_LENGTH), blocker: 'b'.repeat(MAX_BLOCKER_LENGTH) };
    expect(parseClassifyRequest(at)).toEqual(at);
    expect(parseClassifyRequest({ ...at, currentTask: at.currentTask + 'a' })).toBeNull();
    expect(parseClassifyRequest({ ...at, blocker: at.blocker + 'b' })).toBeNull();
  });
});
