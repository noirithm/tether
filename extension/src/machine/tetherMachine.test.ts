import { describe, expect, it, vi } from 'vitest';
import { createActor, fromPromise, waitFor } from 'xstate';
import type { Classification, ClassifyRequest, FrictionEvent } from '@tether/shared';
import { FALLBACK_CLASSIFICATION } from './fallback';
import { tetherMachine } from './tetherMachine';

const pause: FrictionEvent = { kind: 'INPUT_PARALYSIS', at: 0, idleMs: 45_000 };

const credentialFix: Classification = {
  category: 'MISSING_CREDENTIAL',
  suggested_micro_step: 'Open your password manager and search for the portal login.',
};

function boot(
  classify: (request: ClassifyRequest) => Promise<Classification> = async () => credentialFix,
) {
  const machine = tetherMachine.provide({
    actors: {
      classify: fromPromise<Classification, ClassifyRequest>(({ input }) => classify(input)),
    },
  });
  return createActor(machine).start();
}

type Actor = ReturnType<typeof boot>;

function stepTexts(actor: Actor) {
  return actor.getSnapshot().context.queue.map((step) => step.text);
}

function getStuck(actor: Actor) {
  actor.send({ type: 'GOAL.SUBMIT', goal: 'File the tax form' });
  actor.send({ type: 'FRICTION.DETECTED', event: pause });
  actor.send({ type: 'FRICTION.STUCK' });
}

describe('tetherMachine', () => {
  it('starts idle and ignores a blank goal', () => {
    const actor = boot();
    expect(actor.getSnapshot().matches('IDLE')).toBe(true);
    actor.send({ type: 'GOAL.SUBMIT', goal: '   ' });
    expect(actor.getSnapshot().matches('IDLE')).toBe(true);
  });

  it('shows the submitted goal as the only step', () => {
    const actor = boot();
    actor.send({ type: 'GOAL.SUBMIT', goal: '  File the tax form ' });
    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
    expect(stepTexts(actor)).toEqual(['File the tax form']);
  });

  it('returns to idle once the last step is done', () => {
    const actor = boot();
    actor.send({ type: 'GOAL.SUBMIT', goal: 'File the tax form' });
    actor.send({ type: 'STEP.DONE' });
    expect(actor.getSnapshot().matches('IDLE')).toBe(true);
    expect(stepTexts(actor)).toEqual([]);
  });

  it('ignores friction events outside EXECUTING', () => {
    const actor = boot();
    actor.send({ type: 'FRICTION.DETECTED', event: pause });
    expect(actor.getSnapshot().matches('IDLE')).toBe(true);
  });

  it('records friction and resumes on the same step', () => {
    const actor = boot();
    actor.send({ type: 'GOAL.SUBMIT', goal: 'File the tax form' });
    actor.send({ type: 'FRICTION.DETECTED', event: pause });
    expect(actor.getSnapshot().matches('FRICTION_DETECTED')).toBe(true);
    expect(actor.getSnapshot().context.friction).toEqual(pause);

    actor.send({ type: 'FRICTION.RESUME' });
    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
    expect(stepTexts(actor)).toEqual(['File the tax form']);
  });

  it('asks for a blocker first and ignores a blank one', () => {
    const classify = vi.fn(async (_request: ClassifyRequest) => credentialFix);
    const actor = boot(classify);
    getStuck(actor);
    expect(actor.getSnapshot().matches({ DIAGNOSING: 'asking' })).toBe(true);

    actor.send({ type: 'BLOCKER.SUBMIT', blocker: '   ' });
    expect(actor.getSnapshot().matches({ DIAGNOSING: 'asking' })).toBe(true);
    expect(classify).not.toHaveBeenCalled();
  });

  it('classifies the blocker and mounts the side quest in front of the step', async () => {
    const classify = vi.fn(async (_request: ClassifyRequest) => credentialFix);
    const actor = boot(classify);
    getStuck(actor);
    actor.send({ type: 'BLOCKER.SUBMIT', blocker: " can't find the login " });

    await waitFor(actor, (snapshot) => snapshot.matches('RESOLVING'));

    expect(classify).toHaveBeenCalledWith({
      currentTask: 'File the tax form',
      blocker: "can't find the login",
    });
    const { queue } = actor.getSnapshot().context;
    expect(queue[0]).toMatchObject({
      text: credentialFix.suggested_micro_step,
      category: 'MISSING_CREDENTIAL',
    });
    expect(queue[1]?.text).toBe('File the tax form');
  });

  it('returns to the original step once the side quest is done', async () => {
    const actor = boot();
    getStuck(actor);
    actor.send({ type: 'BLOCKER.SUBMIT', blocker: 'no login' });
    await waitFor(actor, (snapshot) => snapshot.matches('RESOLVING'));

    actor.send({ type: 'STEP.DONE' });
    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
    expect(stepTexts(actor)).toEqual(['File the tax form']);
  });

  it('falls back to a generic side quest when the classifier fails', async () => {
    const classify = vi.fn(async (_request: ClassifyRequest): Promise<Classification> => {
      throw new Error('offline');
    });
    const actor = boot(classify);
    getStuck(actor);
    actor.send({ type: 'BLOCKER.SUBMIT', blocker: 'it is just hard' });

    await waitFor(actor, (snapshot) => snapshot.matches('RESOLVING'));

    const { queue } = actor.getSnapshot().context;
    expect(queue[0]).toMatchObject({
      text: FALLBACK_CLASSIFICATION.suggested_micro_step,
      category: FALLBACK_CLASSIFICATION.category,
    });
    expect(queue[1]?.text).toBe('File the tax form');
  });

  it('backs out of diagnosing without classifying', () => {
    const classify = vi.fn(async (_request: ClassifyRequest) => credentialFix);
    const actor = boot(classify);
    getStuck(actor);
    actor.send({ type: 'BLOCKER.CANCEL' });

    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
    expect(stepTexts(actor)).toEqual(['File the tax form']);
    expect(classify).not.toHaveBeenCalled();
  });
});

describe('tetherMachine: working away from the screen', () => {
  it('flags the current step as engaged', () => {
    const actor = boot();
    actor.send({ type: 'GOAL.SUBMIT', goal: 'Do the laundry' });
    expect(actor.getSnapshot().context.engaged).toBe(false);

    actor.send({ type: 'STEP.ENGAGE' });
    expect(actor.getSnapshot().context.engaged).toBe(true);
    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
  });

  it('ignores the flag outside EXECUTING', () => {
    const actor = boot();
    actor.send({ type: 'STEP.ENGAGE' });
    expect(actor.getSnapshot().context.engaged).toBe(false);
  });

  it('keeps the flag after a break, since the user is still on the same step', () => {
    const actor = boot();
    actor.send({ type: 'GOAL.SUBMIT', goal: 'Do the laundry' });
    actor.send({ type: 'STEP.ENGAGE' });
    actor.send({ type: 'FRICTION.DETECTED', event: pause });
    actor.send({ type: 'FRICTION.RESUME' });

    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
    expect(actor.getSnapshot().context.engaged).toBe(true);
  });

  it('clears the flag when a side quest takes over the screen', async () => {
    const actor = boot();
    actor.send({ type: 'GOAL.SUBMIT', goal: 'File the tax form' });
    actor.send({ type: 'STEP.ENGAGE' });
    actor.send({ type: 'FRICTION.DETECTED', event: pause });
    actor.send({ type: 'FRICTION.STUCK' });
    actor.send({ type: 'BLOCKER.SUBMIT', blocker: 'no login' });
    await waitFor(actor, (snapshot) => snapshot.matches('RESOLVING'));

    expect(actor.getSnapshot().context.engaged).toBe(false);
  });

  it('clears the flag when the step is finished', () => {
    const actor = boot();
    actor.send({ type: 'GOAL.SUBMIT', goal: 'Do the laundry' });
    actor.send({ type: 'STEP.ENGAGE' });
    actor.send({ type: 'STEP.DONE' });
    expect(actor.getSnapshot().context.engaged).toBe(false);
  });
});
