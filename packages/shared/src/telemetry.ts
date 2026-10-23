export const FRICTION_KINDS = ['TAB_ABANDONED', 'INPUT_PARALYSIS'] as const;
export type FrictionKind = (typeof FRICTION_KINDS)[number];

export type FrictionEvent =
  | { kind: 'TAB_ABANDONED'; at: number }
  | { kind: 'INPUT_PARALYSIS'; at: number; idleMs: number };

export const DEFAULT_PARALYSIS_MS = 45_000;
export const DEFAULT_ABANDON_MS = 4_000;