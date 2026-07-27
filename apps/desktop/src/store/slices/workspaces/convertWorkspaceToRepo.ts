import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
import { updateWorkspaceKind } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { initRepoWithRemote, validateGitRepo } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from './types';

type Input = {
  workspaceId: WorkspaceId;
  remoteUrl: string;
};

export const convertWorkspaceToRepo = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, remoteUrl }: Input): Promise<Workspace> => {
    const workspace = get().workspaces.find((candidate) => candidate.id === workspaceId);
    if (workspace == null) {
      throw new Error(`workspace not found: ${workspaceId}`);
    }
    if (workspace.kind !== 'simple') {
      throw new Error('only a simple workspace can become a dev project');
    }
    const trimmedRemote = remoteUrl.trim();
    if (trimmedRemote === '') {
      throw new Error('pick a repository or paste its remote url');
    }

    const initialized = await initRepoWithRemote({
      path: workspace.rootPath,
      remoteUrl: trimmedRemote,
    });

    const check = await validateGitRepo(initialized.rootPath);
    if (!check.isRepo) {
      throw new Error(check.error ?? 'the folder is still not a git repository');
    }
    const rootPath = check.rootPath ?? initialized.rootPath;

    await updateWorkspaceKind({ db: tauriDatabase, id: workspaceId, kind: 'repo', rootPath });

    const converted: Workspace = {
      ...workspace,
      kind: 'repo',
      rootPath,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    set((state) => ({
      workspaces: state.workspaces.map((candidate) =>
        candidate.id === workspaceId ? converted : candidate,
      ),
    }));
    return converted;
  };
};
