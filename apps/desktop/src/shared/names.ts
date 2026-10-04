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
  runs: 'Runs',
  review: 'Review',
  artifacts: 'Artifacts',
  scripts: 'Scripts',
  terminal: 'Terminal',
  context: 'Context',
  goal: 'Goal',
  decisions: 'Decisions',
  plan: 'Plan',
  files: 'Files',
  runDefaults: 'Run defaults',
  whatsNew: "What's new",
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

const FORMER_NAMES: Readonly<Record<string, ReadonlyArray<string>>> = {
  [NAMES.runDefaults]: ['Rules', 'Workflow rules'],
  [NAMES.runs]: ['Workflows'],
  [NAMES.whatsNew]: ['Changelog'],
};

export const formerNamesOf = (name: string): ReadonlyArray<string> => FORMER_NAMES[name] ?? [];
