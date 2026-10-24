import { isBlockerCategory } from '@tether/shared';
import type { Step, TetherInput } from './machine';

const KEY = 'tether:session';

// Only the steps and the "doing it away from the screen" flag are kept, in this
// browser's local storage. Nothing is sent anywhere. Finishing the last step clears it.

// stored data can be old or edited, so it is checked like any other input
export function parseSaved(value: unknown): TetherInput | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { queue, engaged } = value as Record<string, unknown>;
  if (!Array.isArray(queue) || queue.length === 0) return undefined;

  const steps: Step[] = [];
  for (const item of queue) {
    if (typeof item !== 'object' || item === null) return undefined;
    const { id, text, category } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof text !== 'string' || !text.trim()) return undefined;
    if (category !== undefined && !isBlockerCategory(category)) return undefined;
    steps.push(category === undefined ? { id, text } : { id, text, category });
  }
  return { queue: steps, engaged: engaged === true };
}

const area = () => (typeof chrome === 'undefined' ? undefined : chrome.storage?.local);

export async function loadSession(): Promise<TetherInput | undefined> {
  try {
    const stored = await area()?.get(KEY);
    return parseSaved(stored?.[KEY]);
  } catch {
    return undefined;
  }
}

export async function saveSession(queue: readonly Step[], engaged: boolean): Promise<void> {
  try {
    if (queue.length === 0) await area()?.remove(KEY);
    else await area()?.set({ [KEY]: { queue, engaged } });
  } catch {
    // saving is a convenience; failing must never get in the way of the panel
  }
}
