import { NAMES } from '../../../shared/names';
import { runKindLineOf } from '../startKind/runKindLineOf';

type CountParams = {
  readonly count: number;
};

type NumberParams = {
  readonly number: number;
};

type NameParams = {
  readonly name: string;
};

const ORCHESTRATED_LINE = runKindLineOf({ line: { kind: 'orchestrated' } });

const AUTO_AGENT_LINE = runKindLineOf({ line: { kind: 'autoAgent' } });

export const RUN_ROUTE_COPY = {
  label: 'Start a run',
  fromPreset: ({ name }: NameParams) => `Start from ${name}`,
  placeholder: 'Describe what you want done. Auto picks how to run it.',
  hint: 'Auto picks a workflow or an agent. Type ~preset or @role.',
  attached: 'Attached to this run',
  removeFile: ({ name }: NameParams) => `Remove ${name}`,
  askAboutFile: 'Ask about this file',
  fromThisPreset: 'Start from this preset',
  start: 'Start',
  starting: 'Starting',
  discard: 'Discard',
  retry: 'Retry',
  failed: "Couldn't start the run",
  shapes: {
    plan: ORCHESTRATED_LINE,
    lead: AUTO_AGENT_LINE,
  },
  closeness: {
    follow: 'Follow it',
    adapt: 'Adapt as it goes',
  },
  change: 'Change',
  routeLabel: 'How Auto runs this',
  runItAs: 'Run it as',
  startFrom: 'Start from',
  noPreset: 'No preset',
  withPreset: 'With the preset',
  sessionDefault: 'Start every run in this session like this',
  workspaceDefault: 'New runs start as',
  workspaceDefaultHelp: 'Start a run reads this before it picks. A session default wins.',
  defaults: {
    auto: 'Let Auto pick',
    plan: NAMES.runKind.workflow,
    lead: NAMES.runKind.autoAgent,
  },
  defaultSaved: ({ name }: NameParams) => `New runs start as: ${name}`,
  defaultChanged: 'The default changed since. Nothing was undone.',
  changedTo: {
    plan: 'Changed to a workflow',
    lead: `Changed to an ${NAMES.runKind.autoAgent}`,
  },
  changeFailed: "Couldn't change the run",
  findings: 'What an earlier run found:',
  why: {
    picked: 'you picked it',
    yourDefault: 'your default',
    matches: 'Your ask matches the preset',
    taskWithEnd: 'A task with an end',
    acrossProjects: ({ count }: CountParams) => `A task with an end, across ${count} projects`,
    pullRequest: ({ number }: NumberParams) => `Fixes on pull request #${number}`,
    oneFile: 'One file to look at',
    questionOrCheck: 'A question or a check, and no preset fits',
    unsure: 'Not sure yet: an Auto agent first',
  },
} as const;
