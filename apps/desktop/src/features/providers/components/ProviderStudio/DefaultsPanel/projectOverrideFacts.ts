import { TASKS } from '@goodboy/core';
import type { AuxTaskId, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { pluralize } from '../../../../../shared/utils/pluralize';
import { PROVIDER_LABEL } from '../../../providerLabel';
import { modelNameOf } from './modelNameOf';

export type ProjectOverrideFacts = {
  readonly projectId: ProjectId;
  readonly name: string;
  readonly facts: ReadonlyArray<string>;
};

type Params = {
  readonly projects: ReadonlyArray<Project>;
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
  readonly project: Project;
};

const factsOf = ({ project }: FactsParams): ReadonlyArray<string> => {
  const { taskModels, roleModels, providerPool, defaultProviderId } = project.overrides;
  const taskFacts = FACT_TASKS.flatMap((task) => {
    const preference = taskModels?.[task.id];
    if (preference == null) {
      return [];
    }
    const noun = TASK_NOUN[task.id] ?? task.label.toLowerCase();
    return [`${noun} ${modelNameOf({ provider: preference.providerId, model: preference.model })}`];
  });
  const roleCount = Object.keys(roleModels ?? {}).length;
  return [
    ...taskFacts,
    ...(roleCount > 0 ? [pluralize(roleCount, 'role')] : []),
    ...(providerPool != null && providerPool.length > 0 ? ['its own provider list'] : []),
    ...(defaultProviderId == null
      ? []
      : [`${PROVIDER_LABEL[defaultProviderId]} as default provider`]),
  ];
};

export const projectOverrideFacts = ({
  projects,
  workspaceId,
}: Params): ReadonlyArray<ProjectOverrideFacts> =>
  projects
    .filter(
      (project) => project.workspaceId === workspaceId && project.disconnectedAt === undefined,
    )
    .map((project) => ({
      projectId: project.id,
      name: project.name,
      facts: factsOf({ project }),
    }))
    .filter((entry) => entry.facts.length > 0);
