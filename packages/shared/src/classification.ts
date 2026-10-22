export const BLOCKER_CATEGORIES = [
  'MISSING_CREDENTIAL',
  'EMOTIONAL_OVERWHELM',
  'MISSING_KNOWLEDGE',
  'EXTERNAL_DEPENDENCY',
] as const;
export type BlockerCategory = (typeof BLOCKER_CATEGORIES)[number];

export interface ClassifyRequest {
  currentTask: string;
  blocker: string;
}

export interface Classification {
  category: BlockerCategory;
  suggested_micro_step: string;
}

export function isBlockerCategory(value: unknown): value is BlockerCategory {
  return typeof value === 'string' && (BLOCKER_CATEGORIES as readonly string[]).includes(value);
}
