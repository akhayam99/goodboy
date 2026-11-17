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

const LEAD_LINE = 'Lead';

export const RUN_ROUTE_COPY = {
  label: 'Start a run',
  fromPreset: ({ name }: NameParams) => `Start from ${name}`,
  placeholder: 'What should the Lead get done?',
  leadPlan: ({ name }: NameParams) => `${LEAD_LINE} · plan ${name}`,
  olderPresetWhat: 'A saved list of steps, followed or adapted.',
  hint: '~ workflows, @ roles',
  runAs: {
    startsAs: 'Starts as',
    emptyPresets: 'No saved workflows yet. Save a run as a workflow to start from it.',
  },
  attachFiles: 'Files go to the run',
  attached: 'Attached to this run',
  removeFile: ({ name }: NameParams) => `Remove ${name}`,
  askAboutFile: 'Ask about this file',
  fromThisPreset: 'Start from this workflow',
  start: 'Start',
  starting: 'Starting',
  discard: 'Discard',
  retry: 'Retry',
  failed: "Couldn't start the run",
  shapes: {
    plan: ORCHESTRATED_LINE,
    lead: LEAD_LINE,
  },
  closeness: {
    follow: 'Keep steps',
    adapt: 'May change steps',
  },
  kind: 'Kind',
  setAtStart: 'set at start',
  startNewAs: 'Start a new run as',
  restartAs: 'Restart as',
  changeTo: 'Change it to',
  secondRun: 'Starts a new run with the same goal.',
  restart: 'Ends this run and starts a new one with what it did so far.',
  liveReadOnly: 'Fixed while the run is going. Stop it to restart as something else.',
  stillGoing: 'This run is still going. Stop it before you restart it as something else.',
  notEnded: 'The new run started, but this one did not end. Stop it so only one keeps going.',
  inPlace: 'Changes this run before its first step.',
  withPreset: 'With the workflow',
  workspaceDefault: 'Start as',
  workspaceDefaultHelp: 'Start run uses this unless the session has its own.',
  sessionDefault: 'New runs in this session start as',
  sessionDefaultHelp: ({ name }: NameParams) =>
    `Wins over the workspace default in ${name}. Runs already going keep theirs.`,
  defaults: {
    auto: 'Lead with a preset that fits',
    plan: LEAD_LINE,
    lead: LEAD_LINE,
  },
  defaultSaved: ({ name }: NameParams) => `New runs start as: ${name}`,
  defaultChanged: 'The default changed since. Nothing was undone.',
  changeFailed: "Couldn't change the run",
  findings: 'What an earlier run found:',
  why: {
    picked: 'you picked it',
    yourDefault: 'your default',
    matches: 'Your ask matches the workflow',
    taskWithEnd: 'A task with an end',
    acrossProjects: ({ count }: CountParams) => `A task with an end, across ${count} projects`,
    pullRequest: ({ number }: NumberParams) => `Fixes on pull request #${number}`,
    oneFile: 'One file to look at',
    questionOrCheck: 'A question or a check, and no workflow fits',
    unsure: 'The Lead plans it first',
  },
} as const;
