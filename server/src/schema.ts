import type { ClassifyRequest } from '@tether/shared';

export const MAX_TASK_LENGTH = 200;
export const MAX_BLOCKER_LENGTH = 400;

export function parseClassifyRequest(body: unknown): ClassifyRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { currentTask, blocker } = body as Record<string, unknown>;
  if (typeof currentTask !== 'string' || typeof blocker !== 'string') return null;

  const task = currentTask.trim();
  const reason = blocker.trim();
  if (!task || !reason) return null;
  if (task.length > MAX_TASK_LENGTH || reason.length > MAX_BLOCKER_LENGTH) return null;

  return { currentTask: task, blocker: reason };
}
