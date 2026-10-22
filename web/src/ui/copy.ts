import type { BlockerCategory, FrictionKind } from '@tether/shared';

export const SIDE_QUEST_LABEL: Record<BlockerCategory, string> = {
  MISSING_CREDENTIAL: 'First, get what you need',
  EMOTIONAL_OVERWHELM: 'First, something small',
  MISSING_KNOWLEDGE: 'First, one thing to look up',
  EXTERNAL_DEPENDENCY: 'First, reach out',
};

export const FRICTION_LEAD: Record<FrictionKind, string> = {
  TAB_ABANDONED: 'You stepped away.',
  INPUT_PARALYSIS: 'You paused.',
};
