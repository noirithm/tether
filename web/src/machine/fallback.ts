import type { Classification } from '@tether/shared';

// used when classification fails, so the user always lands on something doable
export const FALLBACK_CLASSIFICATION: Classification = {
  category: 'EMOTIONAL_OVERWHELM',
  suggested_micro_step: 'Stand up, take three slow breaths, then sit back down.',
};
