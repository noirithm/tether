import { useState, type FormEvent } from 'react';

interface BlockerFormProps {
  onSubmit: (blocker: string) => void;
  onCancel: () => void;
  // a plain note, shown when something is missing
  hint?: string;
}

export function BlockerForm({ onSubmit, onCancel, hint }: BlockerFormProps) {
  const [blocker, setBlocker] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (blocker.trim()) onSubmit(blocker);
  }

  return (
    <form className="aside-block" onSubmit={submit}>
      <label className="quiet" htmlFor="blocker">
        What's in the way?
      </label>
      <input
        id="blocker"
        autoFocus
        autoComplete="off"
        maxLength={400}
        value={blocker}
        onChange={(event) => setBlocker(event.target.value)}
      />
      {hint && <p className="quiet">{hint}</p>}
      <div className="actions">
        <button type="submit" disabled={!blocker.trim()}>
          Send
        </button>
        <button type="button" onClick={onCancel}>
          Never mind
        </button>
      </div>
    </form>
  );
}
