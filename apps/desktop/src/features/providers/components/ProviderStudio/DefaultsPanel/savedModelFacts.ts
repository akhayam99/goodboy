import { TASKS } from '@goodboy/core';
import type { AuxTaskId, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { pluralize } from '../../../../../shared/utils/pluralize';
import type { SavedProjectModels } from '../../../../../store/slices/saved-project-models/state';
import { modelNameOf } from './modelNameOf';

export type SavedModelFacts = {
  readonly projectId: ProjectId;
  readonly name: string;
  readonly facts: ReadonlyArray<string>;
};

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly saved: Readonly<Record<string, SavedProjectModels>>;
  readonly workspaceId: WorkspaceId;
};

const TASK_NOUN: Partial<Record<AuxTaskId, string>> = {
  workflow_orchestrator: 'orchestrator',
  summarizer: 'summaries',
};

const FACT_TASKS = [
  ...TASKS.filter((task) => task.id === 'workflow_orchestrator'),
  ...TASKS.filter((task) => task.id !== 'workflow_orchestrator'),
];

type FactsParams = {
  readonly models: SavedProjectModels;
};

const factsOf = ({ models }: FactsParams): ReadonlyArray<string> => {
  const taskFacts = FACT_TASKS.flatMap((task) => {
    const preference = models.taskModels?.[task.id];
    if (preference == null) {
      return [];
    }
    const noun = TASK_NOUN[task.id] ?? task.label.toLowerCase();
    return [`${noun} ${modelNameOf({ provider: preference.providerId, model: preference.model })}`];
  });
  const roleCount = Object.keys(models.roleModels ?? {}).length;
  return [...taskFacts, ...(roleCount > 0 ? [pluralize(roleCount, 'role')] : [])];
};

export const savedModelFacts = ({
  projects,
  saved,
  workspaceId,
}: Params): ReadonlyArray<SavedModelFacts> =>
  projects.flatMap((project): SavedModelFacts[] => {
    const models = saved[project.id];
    if (project.workspaceId !== workspaceId || models === undefined) {
      return [];
    }
    const facts = factsOf({ models });
    return facts.length === 0 ? [] : [{ projectId: project.id, name: project.name, facts }];
  });
