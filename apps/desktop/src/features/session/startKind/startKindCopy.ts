import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/utils/names';
import type { StartShape } from '../../../store/slices/sessionDraft/state';

type ShapeCard = Readonly<{
  icon: LucideIcon;
  what: string;
  whileRuns: string;
}>;

type NameParams = {
  readonly name: string;
};

type CountParams = {
  readonly count: number;
};

export const START_KIND_COPY = {
  question: 'What kind of run?',
  how: 'How',
  pickLine: 'A Lead by default. Or a preset, or one agent.',
  kindLine: {
    lead: 'Plans it and starts the agents it needs.',
    preset: 'The Lead follows a saved preset.',
    agent: 'One role, no Lead.',
  },
  kindTab: {
    lead: 'Lead',
    preset: 'Preset',
    agent: 'Agent',
  },
  settings: 'Run settings',
  more: 'More',
  less: 'Less',
  edits: {
    label: NAMES.edits,
    help: 'What agents may do in this session. The chat box changes it later.',
    thisSession: 'this session',
  },
  guidance: {
    label: NAMES.guidance,
    title: 'Guidance for this run',
    readers: {
      auto: 'Read by the Lead and the agents it starts.',
      agent: 'Read by the agent at the start of its brief.',
      orchestrator: 'Read by the orchestrator, which carries it into each step.',
    },
    field: 'Guidance text',
    placeholder: 'Rules this run should follow',
    useWorkspace: 'Use workspace guidance',
    none: 'No guidance',
    noneValue: 'None',
    thisRun: 'this run',
    fromWorkspace: ({ name }: NameParams) => `from ${name}`,
    chainDefault: ({ name }: NameParams) => `From ${name}.`,
    chainEmpty: ({ name }: NameParams) => `${name} has no guidance.`,
    chainOwn: ({ name }: NameParams) => `This run only. ${name} keeps its own.`,
  },
  goal: NAMES.goal,
  goalPlaceholder: 'Describe the goal, or pick one from Tasks',
  pickTask: 'Pick from Tasks',
  where: {
    label: 'Projects',
    auto: 'Auto picks',
    count: ({ count }: CountParams) => `${count}`,
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
    follow: 'Keep steps',
    adapt: 'May change steps',
    followLine: 'The saved steps in order. The Lead asks before a change.',
    adaptLine: 'The Lead may add, skip or move a step, and says why.',
  },
  role: 'Role',
  starting: 'Starting',
  discard: 'Discard',
  goalNeeded: 'Write the goal first.',
  presetNeeded: 'Pick a preset first.',
  failed: "Couldn't start the run",
  lastStartFailed: "Couldn't read your last start",
  shapes: {
    orchestrated: {
      icon: CONCEPT_ICONS.orchestrator,
      what: 'Orchestrated plans each next step as it goes.',
      whileRuns: 'While it runs, the plan grows one step at a time, each with why.',
    },
    preset: {
      icon: CONCEPT_ICONS.plan,
      what: 'The Lead follows a saved preset as its plan.',
      whileRuns: 'While it runs, the Lead starts an agent per step and says why it changes one.',
    },
    agent: {
      icon: CONCEPT_ICONS.agents,
      what: 'One role you pick, on the model you pick.',
      whileRuns: 'While it runs, you answer between turns.',
    },
    autoAgent: {
      icon: CONCEPT_ICONS.auto,
      what: 'The Lead plans it and starts the agents it needs, under your limit.',
      whileRuns: 'While it runs, its agents show under it, against your limit.',
    },
  } satisfies Record<StartShape, ShapeCard>,
} as const;
