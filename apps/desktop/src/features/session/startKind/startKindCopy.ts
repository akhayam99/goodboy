import { NAMES } from '../../../shared/utils/names';
import type { StartShape } from '../../../store/slices/sessionDraft/state';

type ShapeCard = Readonly<{
  what: string;
}>;

type NameParams = {
  readonly name: string;
};

type CountParams = {
  readonly count: number;
};

export const START_KIND_COPY = {
  plan: {
    label: 'Plan',
    lead: 'The Lead plans it',
    preset: 'Follow a workflow',
    agent: 'One agent',
    leadLine: 'The Lead writes a plan first, then starts the agents it needs.',
    agentLine: 'One role you pick, on the model you pick. You answer between turns.',
    followLine: ({ count }: CountParams) =>
      count === 1
        ? 'The Lead runs its one step as written.'
        : `The Lead runs the ${count} steps as written.`,
    adaptLine: ({ name }: NameParams) =>
      `The Lead starts from ${name} and says why when it changes a step.`,
  },
  settings: 'Run settings',
  change: 'Change',
  done: 'Done',
  words: {
    stops: 'Stops',
    stopsStep: 'at every step',
    stopsPlan: 'after the plan',
    stopsNever: 'Never stops',
    limit: 'Limit',
    limitNone: 'none',
    projects: 'Projects',
    projectsAuto: 'picked for you',
    projectCount: ({ count }: CountParams) => `${count} projects`,
    guidanceOwn: 'for this run',
  },
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
  preset: 'Workflow',
  pickPreset: 'Pick a workflow',
  noPresets: 'No saved workflows yet. Save a run as a workflow to start from it.',
  presetSteps: 'Workflow steps',
  keepSteps: 'Keep its steps as written',
  role: 'Role',
  starting: 'Starting',
  discard: 'Discard',
  goalNeeded: 'Write the goal first.',
  presetNeeded: 'Pick a workflow first.',
  failed: "Couldn't start the run",
  lastStartFailed: "Couldn't read your last start",
  shapes: {
    orchestrated: {
      what: 'Orchestrated plans each next step as it goes.',
    },
    preset: {
      what: 'The Lead follows a saved workflow as its plan.',
    },
    agent: {
      what: 'One role you pick, on the model you pick.',
    },
    autoAgent: {
      what: 'The Lead plans it and starts the agents it needs, under your limit.',
    },
  } satisfies Record<StartShape, ShapeCard>,
} as const;
