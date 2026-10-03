import type { ContextDrawerTab } from '../../../../store/slices/drawer/state';

export type ContextSlotKey = 'goal' | 'decisions' | 'last_output_summary';

export type ContextSlotTab = Exclude<ContextDrawerTab, 'learned'>;

export const CONTEXT_TABS: ReadonlyArray<ContextDrawerTab> = [
  'goal',
  'decisions',
  'summary',
  'learned',
];

export const CONTEXT_TAB_LABEL: Readonly<Record<ContextDrawerTab, string>> = {
  goal: 'Goal',
  decisions: 'Decisions',
  summary: 'Summary',
  learned: 'Learned',
};

export const CONTEXT_TAB_SLOT: Readonly<Record<ContextSlotTab, ContextSlotKey>> = {
  goal: 'goal',
  decisions: 'decisions',
  summary: 'last_output_summary',
};
