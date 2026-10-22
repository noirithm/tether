import type { ReactNode } from 'react';
import { useMachine } from '@xstate/react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { tetherMachine } from './machine';
import { useTelemetry } from './telemetry';
import { BlockerForm } from './ui/BlockerForm';
import { FrictionPrompt } from './ui/FrictionPrompt';
import { GoalPrompt } from './ui/GoalPrompt';
import { Fade } from './ui/Scene';
import { StepView } from './ui/StepView';

// ?paralysis=5000 shortens the idle window for manual testing
const paralysisMs = Number(new URLSearchParams(location.search).get('paralysis')) || undefined;

export function App() {
  const [snapshot, send] = useMachine(tetherMachine);
  const step = snapshot.context.queue[0];
  const { friction } = snapshot.context;

  useTelemetry({
    active: snapshot.matches('EXECUTING'),
    resetKey: step?.id,
    paralysisMs,
    onFriction: (event) => send({ type: 'FRICTION.DETECTED', event }),
  });

  const dimmed = snapshot.matches('FRICTION_DETECTED') || snapshot.matches('DIAGNOSING');

  let aside: ReactNode = null;
  if (snapshot.matches('FRICTION_DETECTED') && friction) {
    aside = (
      <Fade key="pause">
        <FrictionPrompt
          kind={friction.kind}
          onStuck={() => send({ type: 'FRICTION.STUCK' })}
          onBreak={() => send({ type: 'FRICTION.RESUME' })}
        />
      </Fade>
    );
  } else if (snapshot.matches({ DIAGNOSING: 'asking' })) {
    aside = (
      <Fade key="ask">
        <BlockerForm
          onSubmit={(blocker) => send({ type: 'BLOCKER.SUBMIT', blocker })}
          onCancel={() => send({ type: 'BLOCKER.CANCEL' })}
        />
      </Fade>
    );
  } else if (snapshot.matches({ DIAGNOSING: 'classifying' })) {
    aside = (
      <Fade key="wait">
        <p className="quiet">One moment...</p>
      </Fade>
    );
  }

  const scene =
    snapshot.matches('IDLE') || !step ? (
      <GoalPrompt key="idle" onSubmit={(goal) => send({ type: 'GOAL.SUBMIT', goal })} />
    ) : (
      <StepView
        key={step.id}
        step={step}
        dimmed={dimmed}
        onDone={() => send({ type: 'STEP.DONE' })}
      >
        <AnimatePresence mode="wait">{aside}</AnimatePresence>
      </StepView>
    );

  return (
    <MotionConfig reducedMotion="user">
      <main className="stage">
        <AnimatePresence>{scene}</AnimatePresence>
      </main>
    </MotionConfig>
  );
}
