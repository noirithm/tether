import { useEffect, type ReactNode } from 'react';
import { useMachine } from '@xstate/react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { ABANDON_MS, PARALYSIS_MS } from './config';
import { nudge } from './alert';
import { tetherMachine, type TetherInput } from './machine';
import { saveSession } from './persist';
import { useBrowserSource, useOllamaStatus, useTelemetry } from './telemetry';
import { BlockerForm } from './ui/BlockerForm';
import { PLAN_FAILED_NOTE, SETUP_HINT } from './ui/copy';
import { FrictionPrompt } from './ui/FrictionPrompt';
import { GoalPrompt } from './ui/GoalPrompt';
import { PlanWait } from './ui/PlanWait';
import { Fade } from './ui/Scene';
import { StepView } from './ui/StepView';

export function App({ saved }: { saved?: TetherInput }) {
  const [snapshot, send] = useMachine(tetherMachine, { input: saved });
  const source = useBrowserSource();
  const { queue, friction, engaged, unplannedId } = snapshot.context;
  const step = queue[0];
  const executing = snapshot.matches('EXECUTING');
  const ollama = useOllamaStatus(snapshot.matches({ DIAGNOSING: 'asking' }));

  // keep the steps, so closing the panel doesn't lose them
  useEffect(() => {
    void saveSession(queue, engaged);
  }, [queue, engaged]);

  // A new step id restarts the sensor and its idle clock. Once the user says they're
  // doing the step away from the screen, the sensor stays off until the step is done.
  useTelemetry({
    active: executing && !engaged && source !== undefined,
    source,
    resetKey: step?.id,
    paralysisMs: PARALYSIS_MS,
    abandonMs: ABANDON_MS,
    onFriction: (event) => send({ type: 'FRICTION.DETECTED', event }),
  });

  const dimmed = snapshot.matches('FRICTION_DETECTED') || snapshot.matches('DIAGNOSING');
  const inFriction = snapshot.matches('FRICTION_DETECTED');
  useEffect(() => {
    if (inFriction) nudge();
  }, [inFriction]);

  // a break or side quest shouldn't move the tab that counts as the job
  const holdHome = inFriction || snapshot.matches('DIAGNOSING') || snapshot.matches('RESOLVING');
  useEffect(() => {
    source?.lockHome(holdHome);
  }, [source, holdHome]);

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
          hint={ollama && ollama !== 'ready' ? SETUP_HINT[ollama] : undefined}
        />
      </Fade>
    );
  } else if (snapshot.matches({ DIAGNOSING: 'classifying' })) {
    aside = (
      <Fade key="wait">
        <div className="aside-block">
          <p className="quiet" role="status">
            One moment...
          </p>
          <div className="actions">
            <button type="button" onClick={() => send({ type: 'BLOCKER.CANCEL' })}>
              Never mind
            </button>
          </div>
        </div>
      </Fade>
    );
  }

  let scene: ReactNode;
  if (snapshot.matches('PLANNING')) {
    scene = <PlanWait key="plan" onSkip={() => send({ type: 'PLAN.SKIP' })} />;
  } else if (snapshot.matches('IDLE') || !step) {
    scene = (
      <GoalPrompt
        key="idle"
        onSubmit={(goal) => send({ type: 'GOAL.SUBMIT', goal })}
        onBreakdown={(goal) => send({ type: 'GOAL.BREAKDOWN', goal })}
      />
    );
  } else {
    scene = (
      <StepView
        key={step.id}
        step={step}
        dimmed={dimmed}
        engaged={executing && engaged}
        canEngage={executing && !engaged}
        note={step.id === unplannedId ? PLAN_FAILED_NOTE : undefined}
        onDone={() => send({ type: 'STEP.DONE' })}
        onEngage={() => send({ type: 'STEP.ENGAGE' })}
      >
        <AnimatePresence mode="wait">{aside}</AnimatePresence>
      </StepView>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="stage">
        <AnimatePresence>{scene}</AnimatePresence>
      </main>
    </MotionConfig>
  );
}
