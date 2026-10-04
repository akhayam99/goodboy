import type { AgentRole } from '@goodboy/types';

export const NAMES = {
  needsYou: 'Needs you',
  running: 'Running',
  inReview: 'In review',
  building: 'Building',
  done: 'Done',
  whenToAsk: 'When to ask',
  replyLength: 'Reply length',
  short: 'Short',
  normal: 'Normal',
  long: 'Long',
  stop: 'Stop',
  questions: 'Questions',
  agents: 'Agents',
  workflows: 'Workflows',
  review: 'Review',
  artifacts: 'Artifacts',
  scripts: 'Scripts',
  terminal: 'Terminal',
  context: 'Context',
  goal: 'Goal',
  decisions: 'Decisions',
  plan: 'Plan',
  files: 'Files',
  role: {
    scout: 'Scout',
    planner: 'Planner',
    implementer: 'Implementer',
    reviewer: 'Reviewer',
    tester: 'Tester',
    investigator: 'Debugger',
    docs: 'Docs',
    report: 'Report',
    wireframe: 'Wireframe',
    resolver: 'Resolver',
    rewriter: 'History rewriter',
    scribe: 'Scribe',
    custom: 'Generalist',
  } satisfies Record<AgentRole, string>,
} as const;

type RetiredName = {
  readonly id: string;
  readonly pattern: RegExp;
  readonly use: string;
};

export const RETIRED_NAMES: ReadonlyArray<RetiredName> = [
  { id: 'cancel-turn', pattern: /\bCancel turn\b/, use: NAMES.stop },
  { id: 'verbose', pattern: /\bVerbose\b/, use: NAMES.long },
];
