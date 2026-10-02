import type { IsoDateTime, ProjectId, RemoteProbe } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { projectRemoteProbe } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from '../../slice-types';
import { projectById } from '../projects/projectIndex';

type Input = {
  readonly projectId: ProjectId;
};

export const probeProjectRemote = (set: SetFn, get: GetFn) => {
  return async ({ projectId }: Input): Promise<RemoteProbe> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined || project.kind !== 'repo') {
      return { kind: 'no-remote' };
    }
    const probe = await projectRemoteProbe({
      projectPath: project.rootPath,
      workspaceId: project.workspaceId,
      projectId,
    }).catch((error): RemoteProbe => ({ kind: 'unreachable', reason: formatError(error) }));
    const readAt = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      bootstrapRemoteProbe: { ...state.bootstrapRemoteProbe, [projectId]: { probe, readAt } },
    }));
    return probe;
  };
};
