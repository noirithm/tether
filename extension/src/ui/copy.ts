import type { BlockerCategory, FrictionKind } from '@tether/shared';
import { OLLAMA } from '../config';

export const SIDE_QUEST_LABEL: Record<BlockerCategory, string> = {
  MISSING_CREDENTIAL: 'First, get what you need',
  EMOTIONAL_OVERWHELM: 'First, something small',
  MISSING_KNOWLEDGE: 'First, one thing to look up',
  EXTERNAL_DEPENDENCY: 'First, reach out',
  DISTRACTION: 'First, clear the distraction',
};

export const FRICTION_LEAD: Record<FrictionKind, string> = {
  TAB_ABANDONED: 'You stepped away.',
  INPUT_PARALYSIS: 'You paused.',
};

export const ENGAGED_NOTE = "Take your time. Press Done when you've finished.";

export const PLAN_FAILED_NOTE = "Couldn't break that down, so here's your goal as one step.";

// shown while the local model isn't ready; the suggestion is still a simple one
export const SETUP_HINT = {
  unreachable:
    'Smarter suggestions need Ollama. Install it from ollama.com and keep it running. Until then you get a simple suggestion.',
  missing_model: `One more step for smarter suggestions: open a terminal and run  ollama pull ${OLLAMA.model}  (about 2 GB, once). Until then you get a simple suggestion.`,
} as const;
