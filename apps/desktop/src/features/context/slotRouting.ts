import { SLOT_KEYS, type SlotKey } from '@goodboy/core';
import type { AgentRole } from '@goodboy/types';

export const ROLE_SLOTS: Readonly<Record<AgentRole, ReadonlyArray<SlotKey>>> = {
  scout: ['goal', 'last_output_summary'],
  planner: ['goal', 'open_questions', 'decisions', 'last_output_summary'],
  implementer: ['goal', 'decisions', 'files_touched', 'last_output_summary'],
  reviewer: ['goal', 'decisions', 'files_touched', 'last_output_summary'],
  investigator: ['goal', 'decisions', 'files_touched', 'last_output_summary'],
  tester: SLOT_KEYS,
  resolver: ['goal', 'decisions', 'files_touched'],
  rewriter: SLOT_KEYS,
  scribe: SLOT_KEYS,
  'ci-debugger': ['goal', 'decisions', 'files_touched', 'last_output_summary'],
  'ci-fixer': ['goal', 'decisions', 'files_touched', 'last_output_summary'],
  docs: ['goal', 'last_output_summary'],
  report: SLOT_KEYS,
  wireframe: SLOT_KEYS,
  auto: SLOT_KEYS,
  custom: SLOT_KEYS,
};

export const rolesReadingSlot = ({ slot }: { readonly slot: SlotKey }): ReadonlyArray<AgentRole> =>
  (Object.keys(ROLE_SLOTS) as ReadonlyArray<AgentRole>).filter((role) =>
    ROLE_SLOTS[role].includes(slot),
  );
