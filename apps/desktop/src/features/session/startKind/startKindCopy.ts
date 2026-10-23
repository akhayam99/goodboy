import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/names';
import type { StartShape } from '../../../store/slices/sessionDraft/state';

type PickedKind = 'workflow' | 'agent';

type Card = Readonly<{
  icon: LucideIcon;
  label: string;
  what: string;
  example: string;
}>;

type ShapeCard = Card &
  Readonly<{
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
  subQuestion: {
    workflow: 'Which workflow?',
    agent: 'Which agent?',
  } satisfies Record<PickedKind, string>,
  example: 'Example',
  notSure: 'Not sure? Describe it and Auto picks',
  pickYourself: 'Pick it yourself',
  task: 'Task',
  taskPlaceholder: 'Describe a task, or pick one from Tasks',
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
  goalNeeded: 'Write the task first.',
  presetNeeded: 'Pick a preset first.',
  failed: "Couldn't start the run",
  lastStartFailed: "Couldn't read your last start",
  kinds: {
    workflow: {
      icon: CONCEPT_ICONS.workflows,
      label: NAMES.runKind.workflow,
      what: 'Steps you can see and steer, one agent on each.',
      example: 'Add a settings page: plan it, build it, test it.',
    },
    agent: {
      icon: CONCEPT_ICONS.agents,
      label: NAMES.runKind.agent,
      what: 'One agent works on it in one conversation.',
      example: 'Why does the billing table scroll sideways on a phone?',
    },
  } satisfies Record<PickedKind, Card>,
  shapes: {
    orchestrated: {
      icon: CONCEPT_ICONS.orchestrator,
      label: NAMES.runKind.orchestrated,
      what: 'Auto plans each next step as it goes.',
      example: 'Make the sign in page work offline.',
      whileRuns: 'While it runs, the plan grows one step at a time, each with why.',
    },
    preset: {
      icon: CONCEPT_ICONS.plan,
      label: NAMES.runKind.preset,
      what: 'A saved list of steps, followed or adapted.',
      example: 'Your saved release steps, on this branch.',
      whileRuns: 'While it runs, the saved steps tick off and a change is marked.',
    },
    agent: {
      icon: CONCEPT_ICONS.agents,
      label: NAMES.runKind.agent,
      what: 'One role you pick, on the model you pick.',
      example: 'Scout: list every page that uses the old layout.',
      whileRuns: 'While it runs, you answer between turns.',
    },
    autoAgent: {
      icon: CONCEPT_ICONS.auto,
      label: NAMES.runKind.autoAgent,
      what: 'Auto works on it and starts helpers, under your limit.',
      example: 'Find why the pages drift on wide screens, and fix it.',
      whileRuns: 'While it runs, its helpers show under it, against your limit.',
    },
  } satisfies Record<StartShape, ShapeCard>,
  shapesOfKind: {
    workflow: ['orchestrated', 'preset'],
    agent: ['agent', 'autoAgent'],
  } satisfies Record<PickedKind, ReadonlyArray<StartShape>>,
} as const;
