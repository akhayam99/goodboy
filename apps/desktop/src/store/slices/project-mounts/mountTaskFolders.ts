import type { AgentId, Project, ProjectId, ProviderRunId, SessionId } from '@goodboy/types';
import { isProjectInFirstLap } from '../bootstrap/firstLap';
import { admitProjectMount } from './admitProjectMount';
import { runMaterializationBatch } from './materializationGate';
import { taskFolderCandidates } from './taskFolderCandidates';
import type { GetFn } from './types';

type TaskFolderFailure = Readonly<{
  project: Project;
  error: unknown;
}>;

export type TaskFolderMounts = Readonly<{
  mounted: ReadonlyArray<Project>;
  asked: ReadonlyArray<Project>;
  failed: ReadonlyArray<TaskFolderFailure>;
}>;

type MountTaskFoldersParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly projects: ReadonlyArray<Project>;
  readonly pinnedProjectIds: ReadonlyArray<ProjectId>;
  readonly linkedProjectIds: ReadonlyArray<ProjectId>;
  readonly text: string;
  readonly reason: string;
  readonly agentId: AgentId | null;
  readonly turnRunId: ProviderRunId | null;
  readonly taskIdentifiers?: ReadonlyArray<string>;
};

export const mountTaskFolders = async ({
  get,
  sessionId,
  projects,
  pinnedProjectIds,
  linkedProjectIds,
  text,
  reason,
  agentId,
  turnRunId,
  taskIdentifiers,
}: MountTaskFoldersParams): Promise<TaskFolderMounts> => {
  const candidates = taskFolderCandidates({
    projects,
    pinnedProjectIds,
    linkedProjectIds,
    text,
  }).filter((project) => !isProjectInFirstLap({ state: get(), projectId: project.id }));
  if (candidates.length === 0) {
    return { mounted: [], asked: [], failed: [] };
  }
  return runMaterializationBatch({
    sessionId,
    run: async ({ budget }) => {
      const mounted: Project[] = [];
      const asked: Project[] = [];
      const failed: TaskFolderFailure[] = [];
      for (const project of candidates) {
        try {
          const admitted = await admitProjectMount({
            get,
            sessionId,
            project,
            reason,
            budget,
            agentId,
            turnRunId,
            linkedProjectIds,
            ...(taskIdentifiers === undefined ? {} : { taskIdentifiers }),
          });
          if (admitted.kind === 'asked') {
            asked.push(project);
            continue;
          }
          mounted.push(project);
        } catch (error) {
          failed.push({ project, error });
        }
      }
      return { mounted, asked, failed };
    },
  });
};
