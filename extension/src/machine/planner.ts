import { createOllamaPlanner, type PlanRequest } from '@tether/shared';
import { OLLAMA } from '../config';

// a plan is longer than a classification, and the first answer from a cold model is slow
const TIMEOUT_MS = 40_000;

const plan = createOllamaPlanner(OLLAMA);

export function planGoal(request: PlanRequest, signal?: AbortSignal): Promise<string[]> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return plan(request, signal ? AbortSignal.any([signal, timeout]) : timeout);
}
