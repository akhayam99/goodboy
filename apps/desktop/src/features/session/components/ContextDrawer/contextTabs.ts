import type { ContextDrawerTab } from '../../../../store/slices/drawer/state';

export type ContextSlotKey = 'goal' | 'decisions' | 'last_output_summary';

export const CONTEXT_TABS: ReadonlyArray<ContextDrawerTab> = ['goal', 'decisions', 'summary'];

export const CONTEXT_TAB_LABEL: Readonly<Record<ContextDrawerTab, string>> = {
  goal: 'Goal',
  decisions: 'Decisions',
  summary: 'Summary',
};

export const CONTEXT_TAB_SLOT: Readonly<Record<ContextDrawerTab, ContextSlotKey>> = {
  goal: 'goal',
  decisions: 'decisions',
  summary: 'last_output_summary',
};
