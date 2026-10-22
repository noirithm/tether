import { assertEvent, assign, fromPromise, setup } from 'xstate';
import type {
  BlockerCategory,
  Classification,
  ClassifyRequest,
  FrictionEvent,
} from '@tether/shared';
import { classifyBlocker } from './classifier';
import { FALLBACK_CLASSIFICATION } from './fallback';

export interface Step {
  id: string;
  text: string;
  // set only on side quests
  category?: BlockerCategory;
}

export interface TetherContext {
  // queue[0] is the step on screen
  queue: Step[];
  friction: FrictionEvent | null;
  blocker: string;
}

export type TetherEvent =
  | { type: 'GOAL.SUBMIT'; goal: string }
  | { type: 'STEP.DONE' }
  | { type: 'FRICTION.DETECTED'; event: FrictionEvent }
  | { type: 'FRICTION.RESUME' }
  | { type: 'FRICTION.STUCK' }
  | { type: 'BLOCKER.SUBMIT'; blocker: string }
  | { type: 'BLOCKER.CANCEL' };

// ids only need to be unique within a session; they key the step transition
let sequence = 0;
function makeStep(text: string, category?: BlockerCategory): Step {
  sequence += 1;
  return { id: `step-${sequence}`, text, category };
}

function withSideQuest(queue: Step[], classification: Classification): Step[] {
  return [makeStep(classification.suggested_micro_step, classification.category), ...queue];
}

export const tetherMachine = setup({
  types: {
    context: {} as TetherContext,
    events: {} as TetherEvent,
  },
  actors: {
    classify: fromPromise<Classification, ClassifyRequest>(({ input, signal }) =>
      classifyBlocker(input, signal),
    ),
  },
  guards: {
    hasGoal: ({ event }) => {
      assertEvent(event, 'GOAL.SUBMIT');
      return event.goal.trim() !== '';
    },
    hasBlocker: ({ event }) => {
      assertEvent(event, 'BLOCKER.SUBMIT');
      return event.blocker.trim() !== '';
    },
    isLastStep: ({ context }) => context.queue.length <= 1,
  },
  actions: {
    startGoal: assign(({ event }) => {
      assertEvent(event, 'GOAL.SUBMIT');
      return { queue: [makeStep(event.goal.trim())], friction: null, blocker: '' };
    }),
    recordFriction: assign(({ event }) => {
      assertEvent(event, 'FRICTION.DETECTED');
      return { friction: event.event };
    }),
    recordBlocker: assign(({ event }) => {
      assertEvent(event, 'BLOCKER.SUBMIT');
      return { blocker: event.blocker.trim() };
    }),
    completeStep: assign({ queue: ({ context }) => context.queue.slice(1) }),
  },
}).createMachine({
  id: 'tether',
  context: { queue: [], friction: null, blocker: '' },
  initial: 'IDLE',
  states: {
    IDLE: {
      on: {
        'GOAL.SUBMIT': { guard: 'hasGoal', target: 'EXECUTING', actions: 'startGoal' },
      },
    },
    EXECUTING: {
      on: {
        'STEP.DONE': [
          { guard: 'isLastStep', target: 'IDLE', actions: 'completeStep' },
          { actions: 'completeStep' },
        ],
        'FRICTION.DETECTED': { target: 'FRICTION_DETECTED', actions: 'recordFriction' },
      },
    },
    FRICTION_DETECTED: {
      on: {
        'FRICTION.RESUME': { target: 'EXECUTING' },
        'FRICTION.STUCK': { target: 'DIAGNOSING' },
      },
    },
    DIAGNOSING: {
      initial: 'asking',
      on: { 'BLOCKER.CANCEL': { target: 'EXECUTING' } },
      states: {
        asking: {
          on: {
            'BLOCKER.SUBMIT': {
              guard: 'hasBlocker',
              target: 'classifying',
              actions: 'recordBlocker',
            },
          },
        },
        classifying: {
          invoke: {
            src: 'classify',
            input: ({ context }): ClassifyRequest => ({
              currentTask: context.queue[0]?.text ?? '',
              blocker: context.blocker,
            }),
            onDone: {
              target: '#tether.RESOLVING',
              actions: assign({
                queue: ({ context, event }) => withSideQuest(context.queue, event.output),
              }),
            },
            onError: {
              target: '#tether.RESOLVING',
              actions: assign({
                queue: ({ context }) => withSideQuest(context.queue, FALLBACK_CLASSIFICATION),
              }),
            },
          },
        },
      },
    },
    RESOLVING: {
      on: {
        'STEP.DONE': { target: 'EXECUTING', actions: 'completeStep' },
      },
    },
  },
});
