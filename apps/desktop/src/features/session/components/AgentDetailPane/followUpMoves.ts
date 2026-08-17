import type { Agent } from '@goodboy/types';
import { stripControlMarkers } from '@goodboy/core';
import { AGENT_KIND_META, type AgentKind } from '../../agent-kind';

export type FollowUpKind = Exclude<AgentKind, 'resolver' | 'pr-reviewer'>;

type FollowUpMove = {
  readonly kind: FollowUpKind;
  readonly label: string;
  readonly hint: string;
};

const FOLLOW_UP_KINDS: Readonly<Record<AgentKind, ReadonlyArray<FollowUpKind>>> = {
  reviewer: ['planner', 'implementer'],
  planner: ['implementer'],
  scout: ['planner', 'implementer'],
  debugger: ['implementer'],
  generic: [],
  implementer: [],
  tester: [],
  docs: [],
  resolver: [],
  'pr-reviewer': [],
};

const FOLLOW_UP_HINTS: Readonly<Record<FollowUpKind, Partial<Record<AgentKind, string>>>> = {
  planner: {
    reviewer: 'Turn the review findings into a plan',
    scout: 'Turn the scout report into a plan',
  },
  implementer: {
    reviewer: 'Fix these review findings',
    planner: 'Execute this plan',
    debugger: 'Fix the diagnosed bug',
    scout: 'Implement based on the scout report',
  },
  scout: {},
  debugger: {},
  tester: {},
  reviewer: {},
  docs: {},
  generic: {},
};

export const agentFollowUpMoves = ({
  sourceKind,
}: {
  readonly sourceKind: AgentKind;
}): ReadonlyArray<FollowUpMove> =>
  (FOLLOW_UP_KINDS[sourceKind] ?? []).map((kind) => ({
    kind,
    label: AGENT_KIND_META[kind].label,
    hint: FOLLOW_UP_HINTS[kind][sourceKind] ?? AGENT_KIND_META[kind].hint,
  }));

type ComposeParams = {
  readonly sourceAgent: Agent;
  readonly summary: string;
};

export const composeFollowUpSeed = ({ sourceAgent, summary }: ComposeParams): string => {
  const trimmed = stripControlMarkers(summary).trim();
  const header = `Follow-up from ${sourceAgent.name}.`;
  if (trimmed === '') {
    return header;
  }
  return `${header}\n\n${trimmed}`;
};
