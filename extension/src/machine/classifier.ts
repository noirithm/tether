import { createOllamaClassifier, type Classification, type ClassifyRequest } from '@tether/shared';
import { OLLAMA } from '../config';

// a small model on a plain CPU can take a while, mostly on its first answer
const TIMEOUT_MS = 20_000;

const classify = createOllamaClassifier(OLLAMA);

export function classifyBlocker(
  request: ClassifyRequest,
  signal?: AbortSignal,
): Promise<Classification> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return classify(request, signal ? AbortSignal.any([signal, timeout]) : timeout);
}
