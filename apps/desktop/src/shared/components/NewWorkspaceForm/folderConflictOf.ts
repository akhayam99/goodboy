import { countRunningAdoptionAgents, describeProjectAdoption } from '@goodboy/db';
import { tauriDatabase } from '../../lib/db';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';
import type { FolderConflict } from './folderEntry';

type Params = {
  readonly conflict: ProjectAttachConflict;
};

export const folderConflictOf = async ({ conflict }: Params): Promise<FolderConflict> => {
  const info = await describeProjectAdoption({ db: tauriDatabase, projectId: conflict.project.id });
  const runningAgentCount =
    info === null
      ? 0
      : await countRunningAdoptionAgents({
          db: tauriDatabase,
          projectId: conflict.project.id,
          info,
        });
  return {
    projectId: conflict.project.id,
    workspaceId: conflict.sourceWorkspace.id,
    workspaceName: conflict.sourceWorkspace.name,
    sessionCount: conflict.sessionCount,
    runningAgentCount,
    isShell: conflict.isShell,
    choice: 'ask',
  };
};
