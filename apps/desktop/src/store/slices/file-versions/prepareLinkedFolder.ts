import type { Project } from '@goodboy/types';
import type { GetFn } from './types';

type Params = Readonly<{
  get: GetFn;
  project: Project;
}>;

export const prepareLinkedFolder = ({ get, project }: Params): void => {
  if (project.kind !== 'folder') {
    return;
  }
  void get()
    .prepareFolderVersions({ folder: project })
    .catch((error: unknown) =>
      get().reportError({
        title: `Saved versions of ${project.name} couldn't start`,
        error,
        severity: 'warning',
        workspaceId: project.workspaceId,
      }),
    );
};
