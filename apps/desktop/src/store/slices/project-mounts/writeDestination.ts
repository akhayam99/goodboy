import type { MountId, Project, ProjectId, SessionProjectMount } from '@goodboy/types';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { projectById } from '../projects/projectIndex';

type WriteDestinationMount = Readonly<{
  kind: 'mount';
  mountId: MountId;
  projectId: ProjectId;
  projectName: string;
  mountName: string;
  branch: string;
  worktreePath: string;
  hasGit: boolean;
}>;

export type WriteDestinationCandidate = WriteDestinationMount;

type WriteDestinationScratch = Readonly<{ kind: 'scratch'; path: string | null }>;

type WriteDestinationRoot = Readonly<{
  kind: 'root';
  projectId: ProjectId;
  projectName: string;
  path: string;
  branch: string;
}>;

export type WriteDestination =
  WriteDestinationMount | WriteDestinationScratch | WriteDestinationRoot;

type DescribeMountParams = {
  readonly mount: SessionProjectMount;
  readonly projectName: string;
};

const describeMount = ({ mount, projectName }: DescribeMountParams): WriteDestinationMount => ({
  kind: 'mount',
  mountId: mount.mountId,
  projectId: mount.projectId,
  projectName,
  mountName: mount.mountName,
  branch: mount.branch,
  worktreePath: mount.worktreePath,
  hasGit: !isBranchlessSession({ branch: mount.branch }),
});

type ResolveParams = {
  readonly mount: SessionProjectMount | null;
  readonly projectName: string | null;
  readonly scratchPath: string | null;
  readonly root?: Omit<WriteDestinationRoot, 'kind'> | null;
};

export const resolveWriteDestination = ({
  mount,
  projectName,
  scratchPath,
  root = null,
}: ResolveParams): WriteDestination => {
  if (mount !== null) {
    return describeMount({ mount, projectName: projectName ?? mount.mountName });
  }
  if (root !== null) {
    return { kind: 'root', ...root };
  }
  return { kind: 'scratch', path: scratchPath };
};

type DisplayNameParams = {
  readonly projectName: string;
  readonly mountName: string;
};

export const mountDisplayName = ({ projectName, mountName }: DisplayNameParams): string =>
  mountName === projectName ? projectName : `${projectName} / ${mountName}`;

export const writeDestinationLabel = (destination: WriteDestination): string => {
  if (destination.kind === 'scratch') {
    return 'session scratch folder';
  }
  if (destination.kind === 'root') {
    return `${destination.projectName} / project folder / ${destination.branch}`;
  }
  if (!destination.hasGit) {
    return `${destination.projectName} / working folder / no git`;
  }
  return `${mountDisplayName({ projectName: destination.projectName, mountName: destination.mountName })} / ${destination.branch}`;
};

const destinationPath = (destination: WriteDestination): string | null => {
  if (destination.kind === 'scratch') {
    return destination.path;
  }
  return destination.kind === 'root' ? destination.path : destination.worktreePath;
};

export const writeDestinationDetail = (destination: WriteDestination): string => {
  const label = writeDestinationLabel(destination);
  const path = destinationPath(destination);
  return path === null ? label : `${label} (${path})`;
};

export const writeDestinationsMatch = (a: WriteDestination, b: WriteDestination): boolean => {
  if (a.kind === 'scratch' && b.kind === 'scratch') {
    return true;
  }
  if (a.kind === 'root' && b.kind === 'root') {
    return a.projectId === b.projectId;
  }
  if (a.kind !== 'mount' || b.kind !== 'mount') {
    return false;
  }
  return a.mountId === b.mountId;
};

type ListParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Project>;
};

export const listWriteDestinationCandidates = ({
  mounts,
  projects,
}: ListParams): ReadonlyArray<WriteDestinationCandidate> =>
  mounts.flatMap((mount) => {
    if (!mount.isAttached || mount.worktreePath === '') {
      return [];
    }
    const project = projectById(projects, mount.projectId);
    return [describeMount({ mount, projectName: project?.name ?? mount.mountName })];
  });
