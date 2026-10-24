import { assertEvent, assign, fromPromise, setup } from 'xstate';
import type {
  BlockerCategory,
  Classification,
  ClassifyRequest,
  FrictionEvent,
  PlanRequest,
} from '@tether/shared';
import { classifyBlocker } from './classifier';
import { fallbackFor } from './fallback';
import { planGoal } from './planner';

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
  // the goal waiting to be broken down
  goal: string;
  // the step that stands in for a plan that couldn't be made, so the screen can say so
  unplannedId: string | null;
  // the user said they're doing the current step away from the screen
  engaged: boolean;
  // how often the user answered "still working" on one step; read it with patienceFor
  patience: { stepId: string; count: number };
}

// what a session needs to pick up where the last one stopped
export interface TetherInput {
  queue?: Step[];
  engaged?: boolean;
}

export type TetherEvent =
  | { type: 'GOAL.SUBMIT'; goal: string }
  | { type: 'GOAL.BREAKDOWN'; goal: string }
  | { type: 'PLAN.SKIP' }
  | { type: 'STEP.DONE' }
  | { type: 'STEP.ENGAGE' }
  | { type: 'FRICTION.DETECTED'; event: FrictionEvent }
  | { type: 'FRICTION.RESUME' }
  | { type: 'FRICTION.FINE' }
  | { type: 'FRICTION.STUCK' }
  | { type: 'BLOCKER.SUBMIT'; blocker: string }
  | { type: 'BLOCKER.CANCEL' };

// Each "still working" doubles how long Tether waits on that step, up to 2^3 = 8 times as long.
const MAX_PATIENCE = 3;

// how many times the user waved off a nudge on the step that's on screen now.
// It belongs to one step, so a new step starts again at zero without anything resetting it.
export function patienceFor({ queue, patience }: TetherContext): number {
  const current = queue[0];
  return current !== undefined && current.id === patience.stepId ? patience.count : 0;
}

// Ids are unique within a session. The stamp keeps them apart from the ids of
// steps restored from an earlier session, because the id keys the step transition.
const session = Date.now().toString(36);
let sequence = 0;
function makeStep(text: string, category?: BlockerCategory): Step {
  sequence += 1;
  return { id: `${session}-${sequence}`, text, category };
}

function withSideQuest(queue: Step[], classification: Classification): Step[] {
  return [makeStep(classification.suggested_micro_step, classification.category), ...queue];
}

function stepsFrom(goal: string, texts: readonly string[]): Step[] {
  const steps = texts.map((text) => makeStep(text));
  return steps.length > 0 ? steps : [makeStep(goal)];
}

export const tetherMachine = setup({
  types: {
    context: {} as TetherContext,
    events: {} as TetherEvent,
    // `| void` is what makes the input optional: xstate drops `undefined` when it infers the type
    input: {} as TetherInput | void,
  },
  actors: {
    classify: fromPromise<Classification, ClassifyRequest>(({ input, signal }) =>
      classifyBlocker(input, signal),
    ),
    plan: fromPromise<string[], PlanRequest>(({ input, signal }) => planGoal(input, signal)),
  },
  guards: {
    hasGoal: ({ event }) => {
      assertEvent(event, ['GOAL.SUBMIT', 'GOAL.BREAKDOWN']);
      return event.goal.trim() !== '';
    },
    hasBlocker: ({ event }) => {
      assertEvent(event, 'BLOCKER.SUBMIT');
      return event.blocker.trim() !== '';
    },
    hasQueue: ({ context }) => context.queue.length > 0,
    startsOnSideQuest: ({ context }) => context.queue[0]?.category !== undefined,
    isLastStep: ({ context }) => context.queue.length <= 1,
  },
  actions: {
    startGoal: assign(({ event }) => {
      assertEvent(event, 'GOAL.SUBMIT');
      return {
        queue: [makeStep(event.goal.trim())],
        friction: null,
        blocker: '',
        unplannedId: null,
        engaged: false,
      };
    }),
    recordGoal: assign(({ event }) => {
      assertEvent(event, 'GOAL.BREAKDOWN');
      return { goal: event.goal.trim() };
    }),
    // the goal as one step, because the user chose to skip the plan
    startFromGoal: assign(({ context }) => ({
      queue: [makeStep(context.goal)],
      friction: null,
      blocker: '',
      unplannedId: null,
      engaged: false,
    })),
    // the goal as one step, because the plan couldn't be made
    startUnplanned: assign(({ context }) => {
      const step = makeStep(context.goal);
      return { queue: [step], friction: null, blocker: '', unplannedId: step.id, engaged: false };
    }),
    recordFriction: assign(({ event }) => {
      assertEvent(event, 'FRICTION.DETECTED');
      return { friction: event.event };
    }),
    // the nudge was wrong, so wait longer on this step before the next one
    easeOff: assign(({ context }) => ({
      patience: {
        stepId: context.queue[0]?.id ?? '',
        count: Math.min(patienceFor(context) + 1, MAX_PATIENCE),
      },
    })),
    recordBlocker: assign(({ event }) => {
      assertEvent(event, 'BLOCKER.SUBMIT');
      return { blocker: event.blocker.trim() };
    }),
    markEngaged: assign({ engaged: true }),
    completeStep: assign({
      queue: ({ context }) => context.queue.slice(1),
      engaged: false,
    }),
  },
}).createMachine({
  id: 'tether',
  context: ({ input }) => ({
    queue: input?.queue ?? [],
    friction: null,
    blocker: '',
    goal: '',
    unplannedId: null,
    engaged: input?.engaged ?? false,
    patience: { stepId: '', count: 0 },
  }),
  initial: 'IDLE',
  states: {
    IDLE: {
      // a restored session has steps waiting, so it goes straight back to them
      always: [
        { guard: 'startsOnSideQuest', target: 'RESOLVING' },
        { guard: 'hasQueue', target: 'EXECUTING' },
      ],
      on: {
        'GOAL.SUBMIT': { guard: 'hasGoal', target: 'EXECUTING', actions: 'startGoal' },
        'GOAL.BREAKDOWN': { guard: 'hasGoal', target: 'PLANNING', actions: 'recordGoal' },
      },
    },
    PLANNING: {
      on: { 'PLAN.SKIP': { target: 'EXECUTING', actions: 'startFromGoal' } },
      invoke: {
        src: 'plan',
        input: ({ context }): PlanRequest => ({ goal: context.goal }),
        onDone: {
          target: 'EXECUTING',
          actions: assign({
            queue: ({ context, event }) => stepsFrom(context.goal, event.output),
            friction: null,
            blocker: '',
            unplannedId: null,
            engaged: false,
          }),
        },
        onError: { target: 'EXECUTING', actions: 'startUnplanned' },
      },
    },
    EXECUTING: {
      on: {
        'STEP.DONE': [
          { guard: 'isLastStep', target: 'IDLE', actions: 'completeStep' },
          { actions: 'completeStep' },
        ],
        'STEP.ENGAGE': { actions: 'markEngaged' },
        'FRICTION.DETECTED': { target: 'FRICTION_DETECTED', actions: 'recordFriction' },
      },
    },
    FRICTION_DETECTED: {
      on: {
        'FRICTION.RESUME': { target: 'EXECUTING' },
        'FRICTION.FINE': { target: 'EXECUTING', actions: 'easeOff' },
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
            // a side quest is a new step, so the "away from the screen" claim doesn't carry over
            onDone: {
              target: '#tether.RESOLVING',
              actions: assign({
                queue: ({ context, event }) => withSideQuest(context.queue, event.output),
                engaged: false,
              }),
            },
            // the model couldn't answer, so pick a step from what the person wrote
            onError: {
              target: '#tether.RESOLVING',
              actions: assign({
                queue: ({ context }) => withSideQuest(context.queue, fallbackFor(context.blocker)),
                engaged: false,
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
