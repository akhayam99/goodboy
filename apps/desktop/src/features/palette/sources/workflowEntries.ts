import type { Workflow } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { PaletteEntry } from '../types';

type Params = {
  readonly workflows: ReadonlyArray<Workflow>;
  readonly start: (workflow: Workflow) => void;
};

const stepsLabel = (workflow: Workflow): string =>
  `${workflow.steps.length} step${workflow.steps.length === 1 ? '' : 's'}`;

export const workflowEntries = ({ workflows, start }: Params): ReadonlyArray<PaletteEntry> =>
  workflows.map((workflow): PaletteEntry => ({
    key: `workflow:${workflow.id}`,
    label: workflow.name,
    kind: 'workflow',
    group: 'workflow',
    icon: CONCEPT_ICONS.workflows,
    detail: workflow.description || stepsLabel(workflow),
    tag: 'Workflow',
    run: () => start(workflow),
  }));
