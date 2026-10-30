import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/utils/names';
import type { StartShape } from '../../../store/slices/sessionDraft/state';

type ShapeCard = Readonly<{
  icon: LucideIcon;
  what: string;
  whileRuns: string;
}>;

type RoleParams = {
  readonly role: string;
};

type NameParams = {
  readonly name: string;
};

type CountParams = {
  readonly count: number;
};

export const START_KIND_COPY = {
  question: 'What kind of run?',
  pickLine: 'Auto picks how to run it. Or pick a kind.',
  kindTab: {
    auto: 'Auto',
    agent: 'Agent',
    orchestrated: 'Orchestrated',
    preset: 'Preset',
  },
  settings: 'Run settings',
  edits: {
    label: 'Edits',
    help: 'What agents may do in this session. The chat box changes it later.',
    thisSession: 'this session',
  },
  goal: NAMES.goal,
  goalPlaceholder: 'Describe the goal, or pick one from Tasks',
  pickTask: 'Pick from Tasks',
  where: {
    label: 'Where',
    auto: 'Auto picks',
    count: ({ count }: CountParams) => `${count} folders`,
  },
  searchTasks: 'Search tasks',
  noTasks: 'No open tasks in this workspace',
  removeTask: ({ name }: NameParams) => `Remove ${name}`,
  preset: 'Preset',
  pickPreset: 'Pick a preset',
  noPresets: 'No presets yet. Save a run as a preset to start from it.',
  presetSteps: 'Preset steps',
  closeness: {
    label: 'With the preset',
    follow: 'Follow it',
    adapt: 'Adapt as it goes',
    followLine: 'The saved steps in order. Auto asks before a change.',
    adaptLine: 'Auto may add, skip or move a step, and says why.',
  },
  role: 'Role',
  start: {
    orchestrated: NAMES.startRun,
    preset: NAMES.startRun,
    agent: ({ role }: RoleParams) => `Start ${role}`,
    autoAgent: `Start ${NAMES.runKind.autoAgent}`,
  },
  starting: 'Starting',
  discard: 'Discard',
  goalNeeded: 'Write the goal first.',
  presetNeeded: 'Pick a preset first.',
  failed: "Couldn't start the run",
  lastStartFailed: "Couldn't read your last start",
  shapes: {
    orchestrated: {
      icon: CONCEPT_ICONS.orchestrator,
      what: 'Auto plans each next step as it goes.',
      whileRuns: 'While it runs, the plan grows one step at a time, each with why.',
    },
    preset: {
      icon: CONCEPT_ICONS.plan,
      what: 'A saved list of steps, followed or adapted.',
      whileRuns: 'While it runs, the saved steps tick off and a change is marked.',
    },
    agent: {
      icon: CONCEPT_ICONS.agents,
      what: 'One role you pick, on the model you pick.',
      whileRuns: 'While it runs, you answer between turns.',
    },
    autoAgent: {
      icon: CONCEPT_ICONS.auto,
      what: 'Auto works on it and starts helpers, under your limit.',
      whileRuns: 'While it runs, its helpers show under it, against your limit.',
    },
  } satisfies Record<StartShape, ShapeCard>,
} as const;
