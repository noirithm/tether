import type { BlockerCategory } from '../src';
import raw from './blockers.json';

export interface Case {
  task: string;
  blocker: string;
  category: BlockerCategory;
}

export const CASES: Case[] = raw as Case[];
