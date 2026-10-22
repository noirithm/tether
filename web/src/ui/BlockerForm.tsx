import { useState, type FormEvent } from 'react';

interface BlockerFormProps {
  onSubmit: (blocker: string) => void;
  onCancel: () => void;
}

export function BlockerForm({ onSubmit, onCancel }: BlockerFormProps) {
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
