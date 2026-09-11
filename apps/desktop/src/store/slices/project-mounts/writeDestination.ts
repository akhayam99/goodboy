import type { MountId, Project, ProjectId, SessionProjectMount } from '@goodboy/types';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';

export type WriteDestinationMount = Readonly<{
  kind: 'mount';
  mountId: MountId;
  projectId: ProjectId;
  projectName: string;
  mountName: string;
  branch: string;
  worktreePath: string;
  hasGit: boolean;
}>;

export type WriteDestinationScratch = Readonly<{ kind: 'scratch'; path: string | null }>;

export type WriteDestination = WriteDestinationMount | WriteDestinationScratch;

type MountToDestinationParams = {
  readonly mount: SessionProjectMount;
  readonly projectName: string;
};

export const mountToWriteDestination = ({
  mount,
  projectName,
}: MountToDestinationParams): WriteDestinationMount | null => {
  if (mount.mountId === undefined) {
    return null;
  }
  return {
    kind: 'mount',
    mountId: mount.mountId,
    projectId: mount.projectId,
    projectName,
    mountName: mount.mountName,
    branch: mount.branch,
    worktreePath: mount.worktreePath,
    hasGit: !isBranchlessSession({ branch: mount.branch }),
  };
};

type ResolveParams = {
  readonly mount: SessionProjectMount | null;
  readonly projectName: string | null;
  readonly scratchPath: string | null;
};

export const resolveWriteDestination = ({
  mount,
  projectName,
  scratchPath,
}: ResolveParams): WriteDestination => {
  if (mount === null) {
    return { kind: 'scratch', path: scratchPath };
  }
  return (
    mountToWriteDestination({ mount, projectName: projectName ?? mount.mountName }) ?? {
      kind: 'scratch',
      path: scratchPath,
    }
  );
};

export const writeDestinationLabel = (destination: WriteDestination): string => {
  if (destination.kind === 'scratch') {
    return 'session scratch folder';
  }
  if (!destination.hasGit) {
    return `${destination.projectName} / working folder / no git`;
  }
  return `${destination.projectName} / ${destination.mountName} / ${destination.branch}`;
};

export const writeDestinationDetail = (destination: WriteDestination): string => {
  const label = writeDestinationLabel(destination);
  const path = destination.kind === 'scratch' ? destination.path : destination.worktreePath;
  return path === null ? label : `${label} (${path})`;
};

export const writeDestinationsMatch = (a: WriteDestination, b: WriteDestination): boolean => {
  if (a.kind === 'scratch' && b.kind === 'scratch') {
    return true;
  }
  if (a.kind === 'mount' && b.kind === 'mount') {
    return a.mountId === b.mountId;
  }
  return false;
};

type ListParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Project>;
};

export const listWriteDestinationCandidates = ({
  mounts,
  projects,
}: ListParams): ReadonlyArray<WriteDestinationMount> =>
  mounts.flatMap((mount) => {
    if (mount.isAttached === false || mount.worktreePath === '') {
      return [];
    }
    const project = projects.find((candidate) => candidate.id === mount.projectId);
    const destination = mountToWriteDestination({
      mount,
      projectName: project?.name ?? mount.mountName,
    });
    return destination === null ? [] : [destination];
  });
