import type { AgentRole } from '@goodboy/types';

const SET_NOUN = {
  scout: 'scouting',
  investigator: 'debugging',
  planner: 'planning',
  implementer: 'implementing',
  tester: 'testing',
  resolver: 'resolving',
  reviewer: 'reviewing',
  rewriter: 'rewriting history',
  scribe: 'writing pull requests',
  'ci-debugger': 'debugging checks',
  'ci-fixer': 'fixing checks',
  docs: 'docs',
  report: 'reports',
  wireframe: 'wireframes',
  auto: 'auto agents',
  custom: 'generalist agents',
} as const satisfies Readonly<Record<AgentRole, string>>;

export const roleSetNoun = (role: AgentRole): string => SET_NOUN[role];
