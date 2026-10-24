import { createOllamaClassifier, type Classification, type ClassifyRequest } from '@tether/shared';
import { DEMO, OLLAMA } from '../config';
import { fallbackFor } from './fallback';

// a small model on a plain CPU can take a while, mostly on its first answer
const TIMEOUT_MS = 20_000;

const classify = createOllamaClassifier(OLLAMA);

export function classifyBlocker(
  request: ClassifyRequest,
  signal?: AbortSignal,
): Promise<Classification> {
  if (DEMO) return Promise.resolve(fallbackFor(request.blocker));
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return classify(request, signal ? AbortSignal.any([signal, timeout]) : timeout);
}
