import type { SlotKey } from '@goodboy/core';
import type { AgentKind } from '../../features/session/agent-kind';

export const AGENT_KIND_SLOTS: Partial<Record<AgentKind, ReadonlyArray<SlotKey>>> = {
  planner: ['goal', 'open_questions', 'decisions', 'last_output_summary'],
  implementer: ['goal', 'decisions', 'files_touched', 'last_output_summary'],
  debugger: ['goal', 'files_touched', 'last_output_summary'],
  reviewer: ['goal', 'files_touched', 'last_output_summary'],
  scout: ['goal', 'last_output_summary'],
  docs: ['goal', 'last_output_summary'],
  resolver: ['files_touched'],
};

export const slotsForKind = (kind: AgentKind): ReadonlyArray<SlotKey> | undefined => {
  return AGENT_KIND_SLOTS[kind];
};
