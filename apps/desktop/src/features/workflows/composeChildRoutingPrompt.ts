import {
  formatWorkflowModelMenu,
  orchestratorModelPool,
  type WorkflowRoutingAvailabilitySnapshot,
} from '@goodboy/core';
import type { AgentRole } from '@goodboy/types';

const CHILD_MARKER_FOR_ROLE: Readonly<Partial<Record<AgentRole, string>>> = {
  scout: '<<fan-out>>',
  reviewer: '<<fan-out>>',
  tester: '<<fan-out>>',
  investigator: '<<fan-out>>',
  planner: '<<clusters>>',
};

type MarkerParams = {
  readonly role: AgentRole;
};

export const childRoutingMarkerForRole = ({ role }: MarkerParams): string | null =>
  CHILD_MARKER_FOR_ROLE[role] ?? null;

const INSTRUCTION = [
  'Every entry you emit in that block may carry its own routing, because the children do not all carry the same complexity.',
  'Add `provider`, `model`, and optionally `effort`, `taskType`, `difficulty` and `modelReason` to each entry.',
  '`provider` and `model` must be copied verbatim from the menu below; `effort` must be one the chosen model supports.',
  '`taskType` is one of exploration, planning, implementation, debugging, review, testing, writing, general.',
  '`difficulty` is one of light, standard, heavy, unknown.',
  '`modelReason` is one short sentence about this child only, at most 240 characters.',
  'Omit the routing fields for an entry you cannot judge; a deterministic selection is made for it instead.',
].join('\n');

type Params = {
  readonly role: AgentRole;
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
};

export const composeChildRoutingPrompt = ({ role, availability }: Params): string => {
  const marker = childRoutingMarkerForRole({ role });
  if (marker === null) {
    return '';
  }
  const options = orchestratorModelPool({ availability });
  if (options.length === 0) {
    return '';
  }
  return [
    `**Per-child model choice** when you emit a ${marker} block.`,
    INSTRUCTION,
    formatWorkflowModelMenu({ options }),
  ].join('\n');
};
