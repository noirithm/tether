import type { BlockerCategory, Classification } from '@tether/shared';

// used when classification fails and nothing in the blocker points anywhere,
// so the user always lands on something doable
export const FALLBACK_CLASSIFICATION: Classification = {
  category: 'EMOTIONAL_OVERWHELM',
  suggested_micro_step: 'Stand up, take three slow breaths, then sit back down.',
};

const STEPS: Record<BlockerCategory, string> = {
  MISSING_CREDENTIAL: 'Open a note and write down exactly which login or access you are missing.',
  EXTERNAL_DEPENDENCY: 'Write one short message asking for what you are waiting on, then send it.',
  MISSING_KNOWLEDGE: 'Open a new tab and type your question as one plain sentence.',
  EMOTIONAL_OVERWHELM: FALLBACK_CLASSIFICATION.suggested_micro_step,
};

// The first rule that matches wins, so the more specific ones come first.
// This only runs when the local model can't answer, so it stays plain on purpose.
const RULES: [BlockerCategory, RegExp][] = [
  [
    'MISSING_CREDENTIAL',
    /\b(password|passcode|log ?in|sign ?in|credentials?|api key|token|2fa|permissions?|access|locked out|username)\b/i,
  ],
  [
    'EXTERNAL_DEPENDENCY',
    /\b(waiting|repl(?:y|ied)|respon(?:d|se|ded)|approv\w*|hear back|heard back|haven['’]?t heard|on hold)\b/i,
  ],
  [
    'MISSING_KNOWLEDGE',
    /\b(don['’]?t know|do not know|no idea|how (?:do|to|can)|what (?:is|are|does)|confus\w*|understand|figure out|not sure|unsure)\b/i,
  ],
  [
    'EMOTIONAL_OVERWHELM',
    /\b(overwhelm\w*|too big|too much|scared|afraid|anxi\w*|dread\w*|stress\w*|tired|exhausted|bor(?:ed|ing)|can['’]?t (?:start|face))\b/i,
  ],
];

// a step that fits what the person wrote, for when the model isn't available
export function fallbackFor(blocker: string): Classification {
  const hit = RULES.find(([, pattern]) => pattern.test(blocker));
  const category = hit ? hit[0] : FALLBACK_CLASSIFICATION.category;
  return { category, suggested_micro_step: STEPS[category] };
}
