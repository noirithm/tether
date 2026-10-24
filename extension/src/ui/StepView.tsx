import type { ReactNode } from 'react';
import type { Step } from '../machine';
import { ENGAGED_NOTE, SIDE_QUEST_LABEL } from './copy';
import { Scene } from './Scene';

interface StepViewProps {
  step: Step;
  dimmed: boolean;
  // the user said they're doing this step away from the screen
  engaged: boolean;
  // offer the "I'm on it" button
  canEngage: boolean;
  // a plain note under the step
  note?: string;
  onDone: () => void;
  onEngage: () => void;
  children?: ReactNode;
}

export function StepView({
  step,
  dimmed,
  engaged,
  canEngage,
  note,
  onDone,
  onEngage,
  children,
}: StepViewProps) {
  return (
    <Scene>
      <div className="step" data-dimmed={dimmed}>
        {step.category && <p className="eyebrow">{SIDE_QUEST_LABEL[step.category]}</p>}
        <h1 className="step-text">{step.text}</h1>
        <div className="actions">
          <button type="button" disabled={dimmed} onClick={onDone}>
            Done
          </button>
          {canEngage && (
            <button type="button" disabled={dimmed} onClick={onEngage}>
              I'm on it
            </button>
          )}
        </div>
        {engaged && <p className="quiet">{ENGAGED_NOTE}</p>}
        {note && <p className="quiet">{note}</p>}
      </div>
      <div className="aside">{children}</div>
    </Scene>
  );
}
