import { formatError } from '@goodboy/ui';
import { sessionById } from '../../slices/sessions/sessionIndex';
import { mountTaskFolders } from '../../slices/project-mounts/mountTaskFolders';
import { taskLinkedProjectIds } from '../../slices/sessions/taskLinkedProjectIds';
import type { GetFn } from '../../slice-types';
import type { MountTaskFoldersParams, TaskFoldersAdded } from './ports';

type Params = {
  readonly get: GetFn;
  readonly params: MountTaskFoldersParams;
};

export const mountAutoTaskFolders = async ({ get, params }: Params): Promise<TaskFoldersAdded> => {
  const { sessionId, requested, text } = params;
  const state = get();
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    return { mounted: [], asked: [], failed: [] };
  }
  const workspaceProjects = state.projects.filter(
    (project) => project.workspaceId === session.workspaceId,
  );
  const wanted = requested?.toLowerCase() ?? null;
  const projects =
    wanted === null
      ? workspaceProjects
      : workspaceProjects.filter((project) => project.name.toLowerCase() === wanted);
  if (projects.length === 0) {
    return { mounted: [], asked: [], failed: [] };
  }
  const linkedProjectIds = taskLinkedProjectIds({
    state,
    workspaceId: session.workspaceId,
    tasks: state.sessionExternalTasks[sessionId] ?? [],
    projects: workspaceProjects,
  });
  const added = await mountTaskFolders({
    get,
    sessionId,
    projects,
    pinnedProjectIds: [],
    linkedProjectIds,
    text,
    reason: 'an Auto agent changes files here',
    agentId: null,
    turnRunId: null,
  });
  return {
    mounted: added.mounted.map((project) => project.name),
    asked: added.asked.map((project) => project.name),
    failed: added.failed.map(({ project, error }) => `${project.name}: ${formatError(error)}`),
  };
};
