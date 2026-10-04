import type { ProjectId, SessionExternalTask, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import { resolveForkBranchName } from '../../../../store/slices/project-mounts/resolveMountNaming';
import { selectProjectById } from '../../../../store/slices/projects/selectProjectById';
import { selectSessionById } from '../../../../store/slices/sessions/selectSessionById';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId | undefined;
  readonly task: SessionExternalTask;
};

export const taskBranchPreview = ({ state, sessionId, projectId, task }: Params): string | null => {
  const session = selectSessionById(state, sessionId);
  if (session === null || projectId === undefined) {
    return null;
  }
  const project = selectProjectById(state, projectId);
  if (project === null) {
    return null;
  }
  return resolveForkBranchName({
    get: () => state,
    session,
    project,
    taken: (state.sessionProjectMounts[sessionId] ?? []).map((mount) => mount.branch),
    taskIdentifier: task.identifier,
    taskTitle: task.title,
  });
};
