import type { AutoDelegationRole } from '@goodboy/core';
import type { AgentKind } from '../../../features/session/agent-kind';

const AGENT_KIND_OF_ROLE = {
  scout: 'scout',
  planner: 'planner',
  investigator: 'debugger',
  reviewer: 'reviewer',
  implementer: 'implementer',
  tester: 'tester',
  docs: 'docs',
  scribe: 'scribe',
  'ci-fixer': 'ci-fixer',
  rewriter: 'rewriter',
} as const satisfies Readonly<Record<AutoDelegationRole, AgentKind>>;

export type ChildKindOfRoleParams = Readonly<{
  role: AutoDelegationRole;
}>;

export const childKindOfRole = ({ role }: ChildKindOfRoleParams): AgentKind =>
  AGENT_KIND_OF_ROLE[role];
