import type { ReactNode } from 'react';
import type { Step } from '../machine';
import { SIDE_QUEST_LABEL } from './copy';
import { Scene } from './Scene';

interface StepViewProps {
  step: Step;
  dimmed: boolean;
  engaged: boolean;
  onDone: () => void;
  // left out when engaging doesn't apply, which hides the button
  onEngage?: () => void;
  children?: ReactNode;
}

export function StepView({ step, dimmed, engaged, onDone, onEngage, children }: StepViewProps) {
  return (
    <Scene>
      <div className="step" data-dimmed={dimmed}>
        {step.category && <p className="eyebrow">{SIDE_QUEST_LABEL[step.category]}</p>}
        <h1 className="step-text">{step.text}</h1>
        <div className="actions">
          <button type="button" disabled={dimmed} onClick={onDone}>
            Done
          </button>
          {onEngage && (
            <button type="button" disabled={dimmed} onClick={onEngage}>
              I'm on it
            </button>
          )}
        </div>
        {engaged && <p className="quiet">Take your time.</p>}
      </div>
      <div className="aside">{children}</div>
    </Scene>
  );
}
