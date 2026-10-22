import {
  isBlockerCategory,
  type Classification,
  type ClassifyRequest,
} from '@tether/shared';
import { API_URL } from '../config';

const TIMEOUT_MS = 8_000;

function isClassification(value: unknown): value is Classification {
  if (typeof value !== 'object' || value === null) return false;
  const { category, suggested_micro_step: step } = value as Record<string, unknown>;
  return isBlockerCategory(category) && typeof step === 'string' && step.trim() !== '';
}

export async function classifyBlocker(
  request: ClassifyRequest,
  signal?: AbortSignal,
): Promise<Classification> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const res = await fetch(`${API_URL}/api/classify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) throw new Error(`classify failed with status ${res.status}`);

  const data: unknown = await res.json();
  if (!isClassification(data)) throw new Error('classify returned an unexpected shape');
  return data;
}
