import type { ReactNode } from 'react';
import type { Step } from '../machine';
import { SIDE_QUEST_LABEL } from './copy';
import { Scene } from './Scene';

interface StepViewProps {
  step: Step;
  dimmed: boolean;
  onDone: () => void;
  children?: ReactNode;
}

export function StepView({ step, dimmed, onDone, children }: StepViewProps) {
  return (
    <Scene>
      <div className="step" data-dimmed={dimmed}>
        {step.category && <p className="eyebrow">{SIDE_QUEST_LABEL[step.category]}</p>}
        <h1 className="step-text">{step.text}</h1>
        <div className="actions">
          <button type="button" disabled={dimmed} onClick={onDone}>
            Done
          </button>
        </div>
      </div>
      <div className="aside">{children}</div>
    </Scene>
  );
}