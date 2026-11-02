import type { Project, WorkspaceId } from '@goodboy/types';
import { countNoun } from '../../shared/utils/countNoun';

type Params = {
  readonly projects: ReadonlyArray<Project> | undefined;
  readonly workspaceId: WorkspaceId | null;
};

const connectedIn = ({ projects, workspaceId }: Params): ReadonlyArray<Project> =>
  workspaceId === null || projects === undefined
    ? []
    : projects.filter(
        (project) => project.workspaceId === workspaceId && project.disconnectedAt === undefined,
      );

export const folderCountLabel = (params: Params): string => {
  const connected = connectedIn(params);
  const plain = connected.filter((project) => project.kind === 'folder').length;
  const repos = connected.length - plain;
  return [
    ...(repos > 0 || plain === 0 ? [countNoun({ count: repos, one: 'project' })] : []),
    ...(plain > 0 ? [countNoun({ count: plain, one: 'plain folder' })] : []),
  ].join(', ');
};
