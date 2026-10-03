import { SLOT_KEYS, type SlotKey } from '@goodboy/core';
import type { AgentRole } from '@goodboy/types';
import type { AgentKind } from '../../features/session/agent-kind';

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
  docs: ['goal', 'last_output_summary'],
  report: SLOT_KEYS,
  wireframe: SLOT_KEYS,
  custom: SLOT_KEYS,
};

export const LEGACY_KIND_SLOTS: Partial<Record<AgentKind, ReadonlyArray<SlotKey>>> = {
  planner: ['goal', 'open_questions', 'decisions', 'last_output_summary'],
  implementer: ['goal', 'decisions', 'files_touched', 'last_output_summary'],
  debugger: ['goal', 'files_touched', 'last_output_summary'],
  reviewer: ['goal', 'files_touched', 'last_output_summary'],
  scout: ['goal', 'last_output_summary'],
  docs: ['goal', 'last_output_summary'],
  resolver: ['goal', 'files_touched'],
};

type SlotsForTurnParams = {
  readonly role: AgentRole;
  readonly kind: AgentKind;
  readonly isRoleMapOn: boolean;
};

export const slotsForTurn = ({
  role,
  kind,
  isRoleMapOn,
}: SlotsForTurnParams): ReadonlyArray<SlotKey> | undefined =>
  isRoleMapOn ? ROLE_SLOTS[role] : LEGACY_KIND_SLOTS[kind];

export const rolesReadingSlot = ({ slot }: { readonly slot: SlotKey }): ReadonlyArray<AgentRole> =>
  (Object.keys(ROLE_SLOTS) as ReadonlyArray<AgentRole>).filter((role) =>
    ROLE_SLOTS[role].includes(slot),
  );
