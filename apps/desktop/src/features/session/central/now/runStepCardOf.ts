import type { Fact, FactCardSpec, FactState } from '@goodboy/ui';
import { AGENT_KIND_META } from '../../agent-kind';
import type { LiveRunGroup, LiveRunStepModel } from './liveGroupsOf';

type Params = {
  readonly group: LiveRunGroup;
  readonly model: string | null;
  readonly time: string | null;
};

type StepParams = {
  readonly group: LiveRunGroup;
};

const currentStepOf = ({ group }: StepParams): LiveRunStepModel | null =>
  group.steps.find((step) => step.state === 'running') ??
  group.steps.find((step) => step.state === 'waiting') ??
  group.steps.find((step) => step.state === 'failed') ??
  group.steps.find((step) => step.state === 'notStarted') ??
  group.steps.at(-1) ??
  null;

type StateParams = {
  readonly step: LiveRunStepModel;
  readonly role: string;
};

const stateOf = ({ step, role }: StateParams): FactState => {
  switch (step.state) {
    case 'running':
      return { tone: 'info', words: `${role} working`, isRunning: true };
    case 'waiting':
      return { tone: 'warning', words: 'Waits for your go' };
    case 'failed':
      return { tone: 'danger', words: 'Failed' };
    case 'done':
      return { tone: 'ok', words: 'Done' };
    case 'notStarted':
      return { tone: 'neutral', words: 'Not started' };
    default: {
      const exhaustive: never = step.state;
      return exhaustive;
    }
  }
};

type NextParams = {
  readonly group: LiveRunGroup;
  readonly step: LiveRunStepModel;
};

const nextOf = ({ group, step }: NextParams): string => {
  const after = group.steps.find((candidate) => candidate.number === step.number + 1);
  if (after !== undefined) {
    return `Step ${after.number}, ${after.title}`;
  }
  return group.kind === 'orchestrated' ? 'The orchestrator picks the next step' : 'The run ends';
};

export const runStepCardOf = ({ group, model, time }: Params): FactCardSpec => {
  const step = currentStepOf({ group });
  if (step === null) {
    return { title: group.title, facts: [] };
  }
  const role = AGENT_KIND_META[step.kind].noun;
  const isRunning = step.state === 'running';
  const facts: ReadonlyArray<Fact> = [
    {
      label: 'Workflow',
      value: group.kind === 'orchestrated' ? 'Orchestrated' : 'Preset',
      note: group.title,
    },
    { label: 'Role', value: role },
    ...(isRunning && model !== null ? [{ label: 'Model', value: model }] : []),
    ...(isRunning && time !== null ? [{ label: 'Time in', value: time }] : []),
    { label: 'Next', value: nextOf({ group, step }) },
  ];
  return {
    title: step.title,
    sub: `Step ${step.number} of ${group.steps.length}`,
    state: stateOf({ step, role }),
    facts,
    footnote:
      group.kind === 'run' && step.state === 'waiting'
        ? `Start step ${step.number} starts the ${role.toLowerCase()}.`
        : 'Click to open the step.',
  };
};
