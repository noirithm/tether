import type { FrictionKind } from '@tether/shared';
import { FRICTION_LEAD } from './copy';

interface FrictionPromptProps {
  kind: FrictionKind;
  onStuck: () => void;
  // the nudge was wrong: the user is fine
  onFine: () => void;
  onBreak: () => void;
}

export function FrictionPrompt({ kind, onStuck, onFine, onBreak }: FrictionPromptProps) {
  return (
    <div className="aside-block">
      <p className="quiet">{FRICTION_LEAD[kind]} Stuck, still working, or taking a break?</p>
      <div className="actions">
        <button type="button" onClick={onStuck}>
          I'm stuck
        </button>
        <button type="button" onClick={onFine}>
          Still working
        </button>
        <button type="button" onClick={onBreak}>
          Taking a break
        </button>
      </div>
    </div>
  );
}
