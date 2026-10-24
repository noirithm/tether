import { useState, type FormEvent } from 'react';
import { Scene } from './Scene';

interface GoalPromptProps {
  onSubmit: (goal: string) => void;
  onBreakdown: (goal: string) => void;
}

export function GoalPrompt({ onSubmit, onBreakdown }: GoalPromptProps) {
  const [goal, setGoal] = useState('');
  const ready = goal.trim() !== '';

  function submit(event: FormEvent) {
    event.preventDefault();
    if (ready) onSubmit(goal);
  }

  return (
    <Scene>
      <form id="goal-form" className="prompt" onSubmit={submit}>
        <label htmlFor="goal">What's the next small thing?</label>
        <input
          id="goal"
          autoFocus
          autoComplete="off"
          maxLength={200}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        />
      </form>
      <div className="actions">
        <button type="submit" form="goal-form" disabled={!ready}>
          Start
        </button>
        <button type="button" disabled={!ready} onClick={() => onBreakdown(goal)}>
          Break it down
        </button>
      </div>
    </Scene>
  );
}
