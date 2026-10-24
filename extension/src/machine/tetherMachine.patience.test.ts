import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import type { FrictionEvent } from '@tether/shared';
import { patienceFor, tetherMachine } from './tetherMachine';

const pause: FrictionEvent = { kind: 'INPUT_PARALYSIS', at: 0, idleMs: 45_000 };

function boot() {
  const actor = createActor(tetherMachine, {
    input: {
      queue: [
        { id: 'a', text: 'Open the form.' },
        { id: 'b', text: 'Send it.' },
      ],
    },
  }).start();
  return actor;
}

type Actor = ReturnType<typeof boot>;

const patience = (actor: Actor) => patienceFor(actor.getSnapshot().context);

function falseAlarm(actor: Actor) {
  actor.send({ type: 'FRICTION.DETECTED', event: pause });
  actor.send({ type: 'FRICTION.FINE' });
}

describe('tetherMachine: waving off a nudge', () => {
  it('goes back to the same step and waits longer', () => {
    const actor = boot();
    expect(patience(actor)).toBe(0);

    falseAlarm(actor);

    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
    expect(actor.getSnapshot().context.queue[0]?.id).toBe('a');
    expect(patience(actor)).toBe(1);
  });

  it('waits longer each time, up to a limit', () => {
    const actor = boot();
    const seen: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      falseAlarm(actor);
      seen.push(patience(actor));
    }
    expect(seen).toEqual([1, 2, 3, 3, 3]);
  });

  it('does not change for a break', () => {
    const actor = boot();
    actor.send({ type: 'FRICTION.DETECTED', event: pause });
    actor.send({ type: 'FRICTION.RESUME' });
    expect(patience(actor)).toBe(0);
  });

  it('starts again at zero on the next step', () => {
    const actor = boot();
    falseAlarm(actor);
    falseAlarm(actor);
    expect(patience(actor)).toBe(2);

    actor.send({ type: 'STEP.DONE' });
    expect(actor.getSnapshot().context.queue[0]?.id).toBe('b');
    expect(patience(actor)).toBe(0);
  });

  it('starts at zero for a new goal', () => {
    const actor = boot();
    falseAlarm(actor);
    actor.send({ type: 'STEP.DONE' });
    actor.send({ type: 'STEP.DONE' });
    actor.send({ type: 'GOAL.SUBMIT', goal: 'Something else' });
    expect(patience(actor)).toBe(0);
  });

  it('is ignored when there is no nudge to wave off', () => {
    const actor = boot();
    actor.send({ type: 'FRICTION.FINE' });
    expect(patience(actor)).toBe(0);
    expect(actor.getSnapshot().matches('EXECUTING')).toBe(true);
  });
});
