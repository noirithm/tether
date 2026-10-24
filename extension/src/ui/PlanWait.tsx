import { Scene } from './Scene';

export function PlanWait({ onSkip }: { onSkip: () => void }) {
  return (
    <Scene>
      <p className="quiet" role="status">
        Breaking it down...
      </p>
      <div className="actions">
        <button type="button" onClick={onSkip}>
          Just start with it
        </button>
      </div>
    </Scene>
  );
}
