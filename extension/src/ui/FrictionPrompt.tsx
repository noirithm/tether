import type { FrictionKind } from '@tether/shared';
import { FRICTION_LEAD } from './copy';

interface FrictionPromptProps {
  kind: FrictionKind;
  onStuck: () => void;
  onBreak: () => void;
}

export function FrictionPrompt({ kind, onStuck, onBreak }: FrictionPromptProps) {
  return (
    <div className="aside-block">
      <p className="quiet">{FRICTION_LEAD[kind]} Are you stuck, or taking a break?</p>
      <div className="actions">
        <button type="button" onClick={onStuck}>
          I'm stuck
        </button>
        <button type="button" onClick={onBreak}>
          Taking a break
        </button>
      </div>
    </div>
  );
}
