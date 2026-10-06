import { Play } from 'lucide-react';
import type { Workflow } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES, formerNamesOf } from '../../../shared/names';
import { modelLabel } from '../../chat/utils/chat-constants';
import type { PaletteEntry } from '../types';

type Params = {
  readonly workflows: ReadonlyArray<Workflow>;
  readonly start: (workflow: Workflow) => void;
};

type ChoiceParams = Params;

type StartRunParams = {
  readonly workflows: ReadonlyArray<Workflow>;
};

const START_RUN_LEVEL_KEY = 'level:start-run';

export type RunConfirmFact = {
  readonly label: string;
  readonly value: string;
};

type FactsParams = {
  readonly workflow: Workflow;
  readonly sessionTitle: string;
  readonly projectNames: ReadonlyArray<string>;
};

const EACH_ROLE = 'Each step follows its role';

export const runConfirmFacts = ({
  workflow,
  sessionTitle,
  projectNames,
}: FactsParams): ReadonlyArray<RunConfirmFact> => {
  const steps = workflow.steps.filter((step) => step.deletedAt === undefined);
  const pinned = [
    ...new Set(
      steps.flatMap((step) => (step.modelOverride === undefined ? [] : [step.modelOverride])),
    ),
  ];
  return [
    { label: 'Session', value: sessionTitle },
    ...(projectNames.length === 0 ? [] : [{ label: 'Project', value: projectNames.join(', ') }]),
    {
      label: 'Model',
      value: pinned.length === 0 ? EACH_ROLE : pinned.map((key) => modelLabel(key)).join(', '),
    },
    { label: 'Steps', value: steps.map((step) => step.name).join(' · ') },
  ];
};

const stepsLabel = (workflow: Workflow): string => {
  const count = workflow.steps.filter((step) => step.deletedAt === undefined).length;
  return `${count} step${count === 1 ? '' : 's'}`;
};

export const workflowEntries = ({ workflows, start }: Params): ReadonlyArray<PaletteEntry> =>
  workflows.map((workflow): PaletteEntry => ({
    key: `workflow:${workflow.id}`,
    label: `Start a run: ${workflow.name}`,
    secondary: [workflow.name],
    kind: 'workflow',
    group: 'workflow',
    icon: CONCEPT_ICONS.workflows,
    detail: workflow.description || stepsLabel(workflow),
    tag: 'Workflow',
    level: { kind: 'confirm-run', workflowId: workflow.id },
    run: () => start(workflow),
  }));

export const workflowChoiceEntries = ({
  workflows,
  start,
}: ChoiceParams): ReadonlyArray<PaletteEntry> =>
  workflows.map((workflow): PaletteEntry => ({
    key: `workflow-choice:${workflow.id}`,
    label: workflow.name,
    kind: 'workflow',
    group: 'workflow',
    icon: CONCEPT_ICONS.workflows,
    detail: workflow.description || stepsLabel(workflow),
    tag: 'Workflow',
    level: { kind: 'confirm-run', workflowId: workflow.id },
    run: () => start(workflow),
  }));

export const startRunEntry = ({ workflows }: StartRunParams): PaletteEntry | null =>
  workflows.length === 0
    ? null
    : {
        key: START_RUN_LEVEL_KEY,
        label: NAMES.startRun,
        secondary: formerNamesOf(NAMES.startRun),
        kind: 'level',
        group: null,
        icon: Play,
        detail: 'from a workflow',
        level: { kind: 'start-run' },
        run: () => undefined,
      };
