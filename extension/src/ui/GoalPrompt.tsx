import { useState, type FormEvent } from 'react';
import { Scene } from './Scene';

export function GoalPrompt({ onSubmit }: { onSubmit: (goal: string) => void }) {
  const [goal, setGoal] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (goal.trim()) onSubmit(goal);
  }

  return (
    <Scene>
      <form className="prompt" onSubmit={submit}>
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
    </Scene>
  );
}
