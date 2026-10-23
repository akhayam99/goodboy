import type { Project, ProjectId, SessionExternalTaskProvider, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { issueRepoProjectIds } from './issueRepoProjectIds';

type LinkedTask = {
  readonly provider: SessionExternalTaskProvider;
  readonly url: string;
  readonly projectId?: ProjectId | null;
};

type Params = {
  readonly state: Pick<AppStore, 'workspaceIntegrations'>;
  readonly workspaceId: WorkspaceId;
  readonly tasks: ReadonlyArray<LinkedTask>;
  readonly projects: ReadonlyArray<Project>;
};

export const taskLinkedProjectIds = ({
  state,
  workspaceId,
  tasks,
  projects,
}: Params): ReadonlyArray<ProjectId> => {
  const explicit = tasks.flatMap((task) =>
    task.projectId === undefined || task.projectId === null ? [] : [task.projectId],
  );
  const gitlabHosts = (state.workspaceIntegrations[workspaceId] ?? []).flatMap((binding) =>
    binding.provider === 'gitlab' ? [binding.config.host] : [],
  );
  return [
    ...new Set([...explicit, ...issueRepoProjectIds({ issues: tasks, projects, gitlabHosts })]),
  ];
};
