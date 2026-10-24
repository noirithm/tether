import { describe, expect, it, vi } from 'vitest';
import { createActor, fromPromise, waitFor } from 'xstate';
import type { Classification, ClassifyRequest, FrictionEvent, PlanRequest } from '@tether/shared';
import { FALLBACK_CLASSIFICATION } from './fallback';
import { tetherMachine, type TetherInput } from './tetherMachine';

const pause: FrictionEvent = { kind: 'INPUT_PARALYSIS', at: 0, idleMs: 45_000 };

const fix: Classification = {
  category: 'MISSING_KNOWLEDGE',
  suggested_micro_step: 'Open a search tab and type your question.',
};

interface Fakes {
  classify?: (request: ClassifyRequest) => Promise<Classification>;
  plan?: (request: PlanRequest, signal: AbortSignal) => Promise<string[]>;
  input?: TetherInput;
}

function boot({ classify = async () => fix, plan = async () => [], input }: Fakes = {}) {
  const machine = tetherMachine.provide({
    actors: {
      classify: fromPromise<Classification, ClassifyRequest>(({ input }) => classify(input)),
      plan: fromPromise<string[], PlanRequest>(({ input, signal }) => plan(input, signal)),
    },
  });
  return createActor(machine, { input }).start();
}

type Actor = ReturnType<typeof boot>;

const texts = (actor: Actor) => actor.getSnapshot().context.queue.map((step) => step.text);

describe('tetherMachine: breaking a goal down', () => {
  it('ignores a blank goal', () => {
    const actor = boot();
    actor.send({ type: 'GOAL.BREAKDOWN', goal: '   ' });
    expect(actor.getSnapshot().matches('IDLE')).toBe(true);
  });

  it('asks the planner and queues the steps in order', async () => {
    const plan = vi.fn(async (_request: PlanRequest) => ['Open the form.', 'Fill in your name.']);
    const actor = boot({ plan });
    actor.send({ type: 'GOAL.BREAKDOWN', goal: '  File the tax form ' });
    expect(actor.getSnapshot().matches('PLANNING')).toBe(true);

    await waitFor(actor, (snapshot) => snapshot.matches('EXECUTING'));

    expect(plan).toHaveBeenCalledOnce();
    expect(plan.mock.calls[0]?.[0]).toEqual({ goal: 'File the tax form' });
    expect(texts(actor)).toEqual(['Open the form.', 'Fill in your name.']);
    expect(actor.getSnapshot().context.unplannedId).toBeNull();

    actor.send({ type: 'STEP.DONE' });
    expect(texts(actor)).toEqual(['Fill in your name.']);
    actor.send({ type: 'STEP.DONE' });
    expect(actor.getSnapshot().matches('IDLE')).toBe(true);
  });

  it('starts with the goal as one step when the plan fails, and says so', async () => {
    const actor = boot({
      plan: async () => {
        throw new Error('offline');
      },
    });
    actor.send({ type: 'GOAL.BREAKDOWN', goal: 'File the tax form' });
    await waitFor(actor, (snapshot) => snapshot.matches('EXECUTING'));

    const { queue, unplannedId } = actor.getSnapshot().context;
    expect(queue.map((step) => step.text)).toEqual(['File the tax form']);
    expect(unplannedId).toBe(queue[0]?.id);
  });

  it('starts with the goal as one step when the plan comes back empty', async () => {
    const actor = boot({ plan: async () => [] });
    actor.send({ type: 'GOAL.BREAKDOWN', goal: 'File the tax form' });
    await waitFor(actor, (snapshot) => snapshot.matches('EXECUTING'));
    expect(texts(actor)).toEqual(['File the tax form']);
  });

  it('lets the user skip the wait and cancels the request', async () => {
    let signal: AbortSignal | undefined;
    const actor = boot({
      plan: (_request, given) => {
        signal = given;
        return new Promise<string[]>(() => {});
      },
    });
    actor.send({ type: 'GOAL.BREAKDOWN', goal: 'File the tax form' });
    actor.send({ type: 'PLAN.SKIP' });

    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
    expect(texts(actor)).toEqual(['File the tax form']);
    expect(actor.getSnapshot().context.unplannedId).toBeNull();
    expect(signal?.aborted).toBe(true);
  });
});

describe('tetherMachine: picking up a saved session', () => {
  const saved: TetherInput = {
    queue: [
      { id: 'old-1', text: 'Open the form.' },
      { id: 'old-2', text: 'Send it.' },
    ],
    engaged: true,
  };

  it('goes straight back to the saved steps', () => {
    const actor = boot({ input: saved });
    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
    expect(texts(actor)).toEqual(['Open the form.', 'Send it.']);
    expect(actor.getSnapshot().context.engaged).toBe(true);
  });

  it('starts idle when nothing was saved', () => {
    expect(boot({ input: {} }).getSnapshot().matches('IDLE')).toBe(true);
    expect(boot({ input: { queue: [] } }).getSnapshot().matches('IDLE')).toBe(true);
    expect(boot().getSnapshot().matches('IDLE')).toBe(true);
  });

  it('finishes a restored session normally', () => {
    const actor = boot({ input: saved });
    actor.send({ type: 'STEP.DONE' });
    actor.send({ type: 'STEP.DONE' });
    expect(actor.getSnapshot().matches('IDLE')).toBe(true);
    expect(texts(actor)).toEqual([]);
  });

  it('never gives a new step the id of a restored one', async () => {
    const actor = boot({ input: saved });
    actor.send({ type: 'FRICTION.DETECTED', event: pause });
    actor.send({ type: 'FRICTION.STUCK' });
    actor.send({ type: 'BLOCKER.SUBMIT', blocker: 'no idea' });
    await waitFor(actor, (snapshot) => snapshot.matches('RESOLVING'));

    const ids = actor.getSnapshot().context.queue.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('tetherMachine: a saved side quest', () => {
  it('comes back as a side quest, and returns to the step when done', () => {
    const actor = boot({
      input: {
        queue: [
          { id: 'old-1', text: 'Look it up.', category: 'MISSING_KNOWLEDGE' },
          { id: 'old-2', text: 'File the tax form' },
        ],
      },
    });
    expect(actor.getSnapshot().matches('RESOLVING')).toBe(true);

    actor.send({ type: 'STEP.DONE' });
    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
    expect(texts(actor)).toEqual(['File the tax form']);
  });
});

describe('tetherMachine: a failed classification', () => {
  it('uses a step that fits what the person wrote', async () => {
    const actor = boot({
      classify: async () => {
        throw new Error('offline');
      },
    });
    actor.send({ type: 'GOAL.SUBMIT', goal: 'File the tax form' });
    actor.send({ type: 'FRICTION.DETECTED', event: pause });
    actor.send({ type: 'FRICTION.STUCK' });
    actor.send({ type: 'BLOCKER.SUBMIT', blocker: 'I forgot my password' });
    await waitFor(actor, (snapshot) => snapshot.matches('RESOLVING'));

    const first = actor.getSnapshot().context.queue[0];
    expect(first?.category).toBe('MISSING_CREDENTIAL');
    expect(first?.text).not.toBe(FALLBACK_CLASSIFICATION.suggested_micro_step);
  });

  it('can be cancelled while it waits', () => {
    const actor = boot({ classify: () => new Promise<Classification>(() => {}) });
    actor.send({ type: 'GOAL.SUBMIT', goal: 'File the tax form' });
    actor.send({ type: 'FRICTION.DETECTED', event: pause });
    actor.send({ type: 'FRICTION.STUCK' });
    actor.send({ type: 'BLOCKER.SUBMIT', blocker: 'stuck' });
    expect(actor.getSnapshot().matches({ DIAGNOSING: 'classifying' })).toBe(true);

    actor.send({ type: 'BLOCKER.CANCEL' });
    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
    expect(texts(actor)).toEqual(['File the tax form']);
  });
});
